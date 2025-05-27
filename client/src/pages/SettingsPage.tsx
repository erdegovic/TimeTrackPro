import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Loader2, Save, Upload, X, Palette, Eye, FileText, Building,
  ChevronRight, ChevronDown, Zap, BrushIcon, Type, CreditCard 
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "@shared/schema";

// Enhanced schema with invoice customization validation
const settingsSchema = z.object({
  // Business Information
  businessName: z.string().min(1, "Business name is required"),
  businessAddress: z.string().optional(),
  businessCity: z.string().optional(),
  businessState: z.string().optional(),
  businessZipCode: z.string().optional(),
  businessCountry: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  businessTaxId: z.string().optional(),
  
  // Banking Information
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankSortCode: z.string().optional(),
  
  // Invoice Settings
  nextInvoiceNumber: z.coerce.number().int().positive("Must be a positive number"),
  defaultTimeFormat: z.enum(["decimal", "time"]),
  defaultCurrency: z.string().min(1, "Currency is required"),
  displayCurrency: z.string().min(1, "Display currency is required"),
  enableTax: z.boolean().default(false),
  defaultTaxRate: z.preprocess(
    (val) => (typeof val === 'number' ? val.toString() : val),
    z.string().transform((val) => (val === '' ? '0' : val))
  ),
  showDueDate: z.boolean().default(true),
  
  // Invoice Customization
  companyLogo: z.string().optional(),
  showLogo: z.boolean().default(true),
  invoiceColorTheme: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  invoiceAccentColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  invoiceTextColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  invoiceBackgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  customFontSize: z.string().regex(/^\d+$/, "Must be a number"),
  invoiceFooterText: z.string().optional(),
  showCompanyDetails: z.boolean().default(true),
  showBankDetails: z.boolean().default(true),
  invoiceTemplate: z.enum(["professional", "modern", "classic", "minimal"]),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// Predefined color palettes
const colorPalettes = [
  {
    name: "Professional Blue",
    primary: "#1f2937",
    accent: "#3b82f6",
    text: "#374151",
    background: "#ffffff"
  },
  {
    name: "Modern Green",
    primary: "#065f46",
    accent: "#10b981",
    text: "#1f2937",
    background: "#ffffff"
  },
  {
    name: "Creative Purple",
    primary: "#581c87",
    accent: "#8b5cf6",
    text: "#374151",
    background: "#ffffff"
  },
  {
    name: "Bold Red",
    primary: "#991b1b",
    accent: "#ef4444",
    text: "#374151",
    background: "#ffffff"
  },
  {
    name: "Elegant Black",
    primary: "#000000",
    accent: "#6b7280",
    text: "#1f2937",
    background: "#ffffff"
  },
  {
    name: "Warm Orange",
    primary: "#ea580c",
    accent: "#f97316",
    text: "#374151",
    background: "#ffffff"
  }
];

// Template styles that affect invoice layout
const templateStyles = {
  professional: {
    headerStyle: "flex justify-between items-start",
    titleSize: "text-3xl",
    spacing: "mb-8",
    borderStyle: "border-t border-b",
    layoutClass: "traditional"
  },
  modern: {
    headerStyle: "flex justify-between items-center bg-gray-50 p-6 rounded-lg",
    titleSize: "text-4xl",
    spacing: "mb-6",
    borderStyle: "border-l-4 bg-gray-50 p-4",
    layoutClass: "clean"
  },
  classic: {
    headerStyle: "text-center border-b-2",
    titleSize: "text-2xl",
    spacing: "mb-12",
    borderStyle: "border border-gray-300",
    layoutClass: "formal"
  },
  minimal: {
    headerStyle: "flex justify-between items-baseline",
    titleSize: "text-xl font-light",
    spacing: "mb-4",
    borderStyle: "border-b",
    layoutClass: "simple"
  }
};

interface CollapsibleSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
}

const customizationSections: CollapsibleSection[] = [
  {
    id: "branding",
    title: "Logo & Branding",
    icon: <BrushIcon className="h-4 w-4" />,
    description: "Upload logo and customize colors"
  },
  {
    id: "colors",
    title: "Color Themes",
    icon: <Palette className="h-4 w-4" />,
    description: "Choose invoice color palette"
  },
  {
    id: "typography",
    title: "Typography & Layout",
    icon: <Type className="h-4 w-4" />,
    description: "Font size and template options"
  }
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("business");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["branding"]));
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: "",
      businessAddress: "",
      businessCity: "",
      businessState: "",
      businessZipCode: "",
      businessCountry: "",
      businessPhone: "",
      businessEmail: "",
      businessTaxId: "",
      bankName: "",
      bankAccountName: "",
      bankAccountNumber: "",
      bankSortCode: "",
      nextInvoiceNumber: 1001,
      defaultTimeFormat: "decimal",
      defaultCurrency: "USD",
      displayCurrency: "USD",
      enableTax: false,
      defaultTaxRate: "0",
      showDueDate: true,
      companyLogo: "",
      showLogo: true,
      invoiceColorTheme: "#1f2937",
      invoiceAccentColor: "#3b82f6",
      invoiceTextColor: "#374151",
      invoiceBackgroundColor: "#ffffff",
      customFontSize: "12",
      invoiceFooterText: "",
      showCompanyDetails: true,
      showBankDetails: true,
      invoiceTemplate: "professional",
    },
  });

  // Watch form values for live preview
  const watchedValues = form.watch();

  // Populate form when settings are loaded
  useEffect(() => {
    if (settings) {
      const formData = {
        ...settings,
        defaultTaxRate: settings.defaultTaxRate?.toString() || "0",
        nextInvoiceNumber: settings.nextInvoiceNumber || 1001,
        customFontSize: settings.customFontSize || "12",
        invoiceColorTheme: settings.invoiceColorTheme || "#1f2937",
        invoiceAccentColor: settings.invoiceAccentColor || "#3b82f6",
        invoiceTextColor: settings.invoiceTextColor || "#374151",
        invoiceBackgroundColor: settings.invoiceBackgroundColor || "#ffffff",
        invoiceTemplate: (settings.invoiceTemplate as "professional" | "modern" | "classic" | "minimal") || "professional",
        showLogo: settings.showLogo ?? true,
        showCompanyDetails: settings.showCompanyDetails ?? true,
        showBankDetails: settings.showBankDetails ?? true,
        businessName: settings.businessName || "",
        businessAddress: settings.businessAddress || "",
        businessCity: settings.businessCity || "",
        businessState: settings.businessState || "",
        businessZipCode: settings.businessZipCode || "",
        businessCountry: settings.businessCountry || "",
        businessPhone: settings.businessPhone || "",
        businessEmail: settings.businessEmail || "",
        businessTaxId: settings.businessTaxId || "",
        bankName: settings.bankName || "",
        bankAccountName: settings.bankAccountName || "",
        bankAccountNumber: settings.bankAccountNumber || "",
        bankSortCode: settings.bankSortCode || "",
        invoiceFooterText: settings.invoiceFooterText || "",
      };
      
      form.reset(formData);
      
      if (settings.companyLogo) {
        setLogoPreview(settings.companyLogo);
      }
    }
  }, [settings, form]);

  // Toggle section visibility
  const toggleSection = (sectionId: string) => {
    const newOpenSections = new Set(openSections);
    if (newOpenSections.has(sectionId)) {
      newOpenSections.delete(sectionId);
    } else {
      newOpenSections.add(sectionId);
    }
    setOpenSections(newOpenSections);
  };

  // Handle logo upload
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 2MB",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setLogoPreview(base64);
        form.setValue("companyLogo", base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove logo
  const removeLogo = () => {
    setLogoPreview(null);
    form.setValue("companyLogo", "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Apply color palette
  const applyColorPalette = (palette: typeof colorPalettes[0]) => {
    form.setValue("invoiceColorTheme", palette.primary);
    form.setValue("invoiceAccentColor", palette.accent);
    form.setValue("invoiceTextColor", palette.text);
    form.setValue("invoiceBackgroundColor", palette.background);
    
    toast({
      title: "Color palette applied",
      description: `${palette.name} theme has been applied to your invoice`,
    });
  };

  // Get current template style
  const currentTemplate = templateStyles[watchedValues.invoiceTemplate as keyof typeof templateStyles] || templateStyles.professional;

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      return await apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully.",
      });
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error("Error updating settings:", error);
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: SettingsFormData) => {
    setIsSubmitting(true);
    updateSettingsMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-600">
          Manage your business information, invoice customization, and preferences
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="business" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Business
              </TabsTrigger>
              <TabsTrigger value="invoice" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoice Settings
              </TabsTrigger>
              <TabsTrigger value="customization" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Invoice Customization
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>

            {/* Business Information Tab */}
            <TabsContent value="business" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Business Information</CardTitle>
                  <CardDescription>
                    Enter your business details that will appear on invoices
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="businessName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Name *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Your Business Name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="businessEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="contact@business.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="businessAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Address</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="123 Business Street" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="businessCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="City" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="businessState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State/Province</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="State" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="businessZipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP/Postal Code</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="12345" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="businessCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Country" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="businessPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+1 (555) 123-4567" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="businessTaxId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax ID</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Tax ID Number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Banking Information</CardTitle>
                  <CardDescription>
                    Banking details for payment instructions on invoices
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Bank Name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="bankAccountName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Account Holder Name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bankAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Account Number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="bankSortCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sort Code / Routing Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Sort Code" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invoice Settings Tab */}
            <TabsContent value="invoice" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Configuration</CardTitle>
                  <CardDescription>
                    Configure default invoice settings and numbering
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="nextInvoiceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Next Invoice Number</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min="1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="defaultCurrency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Currency</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="USD">USD - US Dollar</SelectItem>
                              <SelectItem value="EUR">EUR - Euro</SelectItem>
                              <SelectItem value="GBP">GBP - British Pound</SelectItem>
                              <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                              <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                              <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="displayCurrency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency Symbol</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="$" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="defaultTimeFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Time Format</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="decimal">Decimal (1.5 hours)</SelectItem>
                              <SelectItem value="time">Time (1:30)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Tax Settings</h3>
                    
                    <FormField
                      control={form.control}
                      name="enableTax"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Tax</FormLabel>
                            <div className="text-sm text-gray-600">
                              Add tax calculations to invoices
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    {watchedValues.enableTax && (
                      <FormField
                        control={form.control}
                        name="defaultTaxRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Tax Rate (%)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" min="0" max="100" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="showDueDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Show Due Date</FormLabel>
                          <div className="text-sm text-gray-600">
                            Display due date on invoices
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invoice Customization Tab - Split Screen */}
            <TabsContent value="customization" className="space-y-0">
              <div className="h-[calc(100vh-200px)] flex border rounded-lg overflow-hidden">
                {/* Customization Panel */}
                <div className="w-96 border-r bg-gray-50 overflow-y-auto">
                  <div className="p-4 border-b bg-white">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Live Customization
                    </h3>
                    <p className="text-sm text-gray-600">Changes appear instantly</p>
                  </div>
                  
                  <div className="p-4 space-y-2">
                    {customizationSections.map((section) => (
                      <Collapsible
                        key={section.id}
                        open={openSections.has(section.id)}
                        onOpenChange={() => toggleSection(section.id)}
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-3 h-auto hover:bg-white/80"
                          >
                            <div className="flex items-center gap-3">
                              {section.icon}
                              <div className="text-left">
                                <div className="font-medium text-sm">{section.title}</div>
                                <div className="text-xs text-gray-500">{section.description}</div>
                              </div>
                            </div>
                            {openSections.has(section.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>

                        <CollapsibleContent className="space-y-4 px-3 pb-4">
                          {/* Logo & Branding */}
                          {section.id === "branding" && (
                            <div className="space-y-3">
                              <FormField
                                control={form.control}
                                name="showLogo"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-xs font-medium">Show Logo</FormLabel>
                                      <div className="text-xs text-gray-600">
                                        Display logo on invoices
                                      </div>
                                    </div>
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />

                              <div className="space-y-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="w-full"
                                >
                                  <Upload className="h-3 w-3 mr-2" />
                                  Upload Logo
                                </Button>
                                <p className="text-xs text-gray-600 text-center">
                                  PNG, JPG, GIF (max 2MB)
                                </p>

                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/*"
                                  onChange={handleLogoUpload}
                                  className="hidden"
                                />

                                {logoPreview && (
                                  <div className="relative">
                                    <img
                                      src={logoPreview}
                                      alt="Logo Preview"
                                      className="w-full max-h-16 object-contain border rounded"
                                    />
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onClick={removeLogo}
                                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0"
                                    >
                                      <X className="h-2 w-2" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Color Themes */}
                          {section.id === "colors" && (
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs font-medium">Quick Palettes</Label>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  {colorPalettes.map((palette) => (
                                    <Button
                                      key={palette.name}
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => applyColorPalette(palette)}
                                      className="h-auto p-2 flex flex-col gap-1"
                                    >
                                      <div className="flex gap-1">
                                        <div 
                                          className="w-3 h-3 rounded-full border" 
                                          style={{ backgroundColor: palette.primary }} 
                                        />
                                        <div 
                                          className="w-3 h-3 rounded-full border" 
                                          style={{ backgroundColor: palette.accent }} 
                                        />
                                      </div>
                                      <span className="text-xs">{palette.name}</span>
                                    </Button>
                                  ))}
                                </div>
                              </div>

                              <Separator />

                              <div className="space-y-3">
                                <FormField
                                  control={form.control}
                                  name="invoiceColorTheme"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">Primary Color</FormLabel>
                                      <div className="flex gap-2">
                                        <FormControl>
                                          <Input {...field} type="color" className="w-10 h-8 p-1 cursor-pointer" />
                                        </FormControl>
                                        <FormControl>
                                          <Input {...field} placeholder="#1f2937" className="flex-1 h-8 text-sm" />
                                        </FormControl>
                                      </div>
                                      <FormMessage className="text-xs" />
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={form.control}
                                  name="invoiceAccentColor"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">Accent Color</FormLabel>
                                      <div className="flex gap-2">
                                        <FormControl>
                                          <Input {...field} type="color" className="w-10 h-8 p-1 cursor-pointer" />
                                        </FormControl>
                                        <FormControl>
                                          <Input {...field} placeholder="#3b82f6" className="flex-1 h-8 text-sm" />
                                        </FormControl>
                                      </div>
                                      <FormMessage className="text-xs" />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          )}

                          {/* Typography & Layout */}
                          {section.id === "typography" && (
                            <div className="space-y-3">
                              <FormField
                                control={form.control}
                                name="invoiceTemplate"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Template Style</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="h-8 text-sm">
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="professional">Professional</SelectItem>
                                        <SelectItem value="modern">Modern</SelectItem>
                                        <SelectItem value="classic">Classic</SelectItem>
                                        <SelectItem value="minimal">Minimal</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={form.control}
                                name="customFontSize"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Font Size (px)</FormLabel>
                                    <FormControl>
                                      <Input {...field} type="number" min="8" max="24" className="h-8 text-sm" />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="invoiceFooterText"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Footer Text</FormLabel>
                                    <FormControl>
                                      <Textarea 
                                        {...field} 
                                        placeholder="Thank you for your business!"
                                        rows={2}
                                        className="text-sm"
                                      />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>

                {/* Live Preview */}
                <div className="flex-1 p-6 bg-gray-100 overflow-y-auto">
                  <div className="max-w-2xl mx-auto">
                    <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                      <Zap className="h-4 w-4" />
                      Live Preview - {watchedValues.invoiceTemplate} template
                    </div>
                    
                    <div 
                      className={`bg-white shadow-lg rounded-lg p-8 min-h-[600px] ${currentTemplate.layoutClass}`}
                      style={{ 
                        backgroundColor: watchedValues.invoiceBackgroundColor,
                        color: watchedValues.invoiceTextColor,
                        fontSize: `${watchedValues.customFontSize}px`
                      }}
                    >
                      {/* Template-specific Header */}
                      <div className={`${currentTemplate.headerStyle} ${currentTemplate.spacing}`}>
                        {watchedValues.invoiceTemplate === "classic" ? (
                          // Classic centered layout
                          <div className="w-full text-center">
                            {watchedValues.showLogo && logoPreview && (
                              <img 
                                src={logoPreview} 
                                alt="Company Logo" 
                                className="max-h-16 mx-auto mb-4"
                              />
                            )}
                            <h1 
                              className={`${currentTemplate.titleSize} font-bold mb-2`}
                              style={{ color: watchedValues.invoiceColorTheme }}
                            >
                              INVOICE
                            </h1>
                            {watchedValues.showCompanyDetails && (
                              <div className="text-sm">
                                <div className="font-bold">{watchedValues.businessName || "Your Business Name"}</div>
                                {watchedValues.businessAddress && <div>{watchedValues.businessAddress}</div>}
                                <div>
                                  {[watchedValues.businessCity, watchedValues.businessState, watchedValues.businessZipCode]
                                    .filter(Boolean).join(", ")}
                                </div>
                                {watchedValues.businessEmail && <div>{watchedValues.businessEmail}</div>}
                              </div>
                            )}
                            <div className="mt-4 text-sm">
                              <div>Invoice #: {watchedValues.nextInvoiceNumber}</div>
                              <div>Date: {new Date().toLocaleDateString()}</div>
                            </div>
                          </div>
                        ) : (
                          // Other templates - side by side layout
                          <>
                            <div>
                              {watchedValues.showLogo && logoPreview && (
                                <img 
                                  src={logoPreview} 
                                  alt="Company Logo" 
                                  className="max-h-16 mb-4"
                                />
                              )}
                              {watchedValues.showCompanyDetails && (
                                <div>
                                  <h2 
                                    className="text-xl font-bold mb-2"
                                    style={{ color: watchedValues.invoiceColorTheme }}
                                  >
                                    {watchedValues.businessName || "Your Business Name"}
                                  </h2>
                                  <div className="text-sm space-y-1">
                                    {watchedValues.businessAddress && <div>{watchedValues.businessAddress}</div>}
                                    <div>
                                      {[watchedValues.businessCity, watchedValues.businessState, watchedValues.businessZipCode]
                                        .filter(Boolean).join(", ")}
                                    </div>
                                    {watchedValues.businessEmail && <div>{watchedValues.businessEmail}</div>}
                                    {watchedValues.businessPhone && <div>{watchedValues.businessPhone}</div>}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className={watchedValues.invoiceTemplate === "minimal" ? "text-right" : "text-right"}>
                              <h1 
                                className={`${currentTemplate.titleSize} font-bold mb-2`}
                                style={{ color: watchedValues.invoiceColorTheme }}
                              >
                                INVOICE
                              </h1>
                              <div className="text-sm space-y-1">
                                <div>Invoice #: {watchedValues.nextInvoiceNumber}</div>
                                <div>Date: {new Date().toLocaleDateString()}</div>
                                {watchedValues.showDueDate && (
                                  <div>Due: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Client Information */}
                      <div className="mb-6">
                        <h3 
                          className="font-semibold mb-2"
                          style={{ color: watchedValues.invoiceAccentColor }}
                        >
                          Bill To:
                        </h3>
                        <div>
                          <div className="font-medium">Sample Client</div>
                          <div className="text-sm">123 Client Street</div>
                          <div className="text-sm">Client City, State 12345</div>
                          <div className="text-sm">client@example.com</div>
                        </div>
                      </div>

                      {/* Sample invoice content with template styling */}
                      <div className={`${currentTemplate.borderStyle} py-4 mb-6`}>
                        <div className="grid grid-cols-4 gap-4 font-semibold text-sm mb-2">
                          <div style={{ color: watchedValues.invoiceAccentColor }}>Description</div>
                          <div style={{ color: watchedValues.invoiceAccentColor }}>Hours</div>
                          <div style={{ color: watchedValues.invoiceAccentColor }}>Rate</div>
                          <div style={{ color: watchedValues.invoiceAccentColor }} className="text-right">Amount</div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>Web Development</div>
                          <div>8.5</div>
                          <div>{watchedValues.displayCurrency}75.00</div>
                          <div className="text-right">{watchedValues.displayCurrency}637.50</div>
                        </div>
                      </div>

                      <div className="flex justify-end mb-6">
                        <div className="text-right space-y-1">
                          <div>Subtotal: {watchedValues.displayCurrency}637.50</div>
                          {watchedValues.enableTax && (
                            <div>Tax ({watchedValues.defaultTaxRate}%): {watchedValues.displayCurrency}{(637.50 * parseFloat(watchedValues.defaultTaxRate) / 100).toFixed(2)}</div>
                          )}
                          <div 
                            className="text-lg font-bold pt-2 border-t"
                            style={{ color: watchedValues.invoiceColorTheme }}
                          >
                            Total: {watchedValues.displayCurrency}{watchedValues.enableTax ? (637.50 + (637.50 * parseFloat(watchedValues.defaultTaxRate) / 100)).toFixed(2) : "637.50"}
                          </div>
                        </div>
                      </div>

                      {watchedValues.showBankDetails && (watchedValues.bankName || watchedValues.bankAccountNumber) && (
                        <div className="mb-6 p-4 bg-gray-50 rounded">
                          <h3 className="font-semibold text-sm mb-2" style={{ color: watchedValues.invoiceAccentColor }}>
                            Payment Details
                          </h3>
                          <div className="text-sm space-y-1">
                            {watchedValues.bankName && <div>Bank: {watchedValues.bankName}</div>}
                            {watchedValues.bankAccountName && <div>Account Name: {watchedValues.bankAccountName}</div>}
                            {watchedValues.bankAccountNumber && <div>Account: {watchedValues.bankAccountNumber}</div>}
                            {watchedValues.bankSortCode && <div>Sort Code: {watchedValues.bankSortCode}</div>}
                          </div>
                        </div>
                      )}

                      {watchedValues.invoiceFooterText && (
                        <div className="text-center text-sm border-t pt-4 mt-8">
                          {watchedValues.invoiceFooterText}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Preview</CardTitle>
                  <CardDescription>
                    See how your customizations will look on actual invoices
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div 
                    className="border rounded-lg p-6 max-w-2xl mx-auto"
                    style={{ 
                      backgroundColor: watchedValues.invoiceBackgroundColor,
                      color: watchedValues.invoiceTextColor,
                      fontSize: `${watchedValues.customFontSize}px`
                    }}
                  >
                    {/* Same preview content as customization tab but without live editing */}
                    <div className={`${currentTemplate.headerStyle} ${currentTemplate.spacing}`}>
                      <div>
                        {watchedValues.showLogo && logoPreview && (
                          <img 
                            src={logoPreview} 
                            alt="Company Logo" 
                            className="max-h-16 mb-4"
                          />
                        )}
                        {watchedValues.showCompanyDetails && (
                          <div>
                            <h2 
                              className="text-xl font-bold"
                              style={{ color: watchedValues.invoiceColorTheme }}
                            >
                              {watchedValues.businessName || "Your Business Name"}
                            </h2>
                            <div className="text-sm">
                              {watchedValues.businessAddress && <div>{watchedValues.businessAddress}</div>}
                              <div>
                                {[watchedValues.businessCity, watchedValues.businessState, watchedValues.businessZipCode]
                                  .filter(Boolean).join(", ")}
                              </div>
                              {watchedValues.businessEmail && <div>{watchedValues.businessEmail}</div>}
                              {watchedValues.businessPhone && <div>{watchedValues.businessPhone}</div>}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <h1 
                          className="text-2xl font-bold"
                          style={{ color: watchedValues.invoiceColorTheme }}
                        >
                          INVOICE
                        </h1>
                        <div className="text-sm">
                          <div>Invoice #: {watchedValues.nextInvoiceNumber}</div>
                          <div>Date: {new Date().toLocaleDateString()}</div>
                          {watchedValues.showDueDate && (
                            <div>Due: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h3 
                        className="font-semibold mb-2"
                        style={{ color: watchedValues.invoiceAccentColor }}
                      >
                        Bill To:
                      </h3>
                      <div>
                        <div className="font-medium">Sample Client</div>
                        <div className="text-sm">123 Client Street</div>
                        <div className="text-sm">Client City, State 12345</div>
                        <div className="text-sm">client@example.com</div>
                      </div>
                    </div>

                    <div className="border-t border-b py-4 mb-6">
                      <div className="grid grid-cols-4 gap-4 font-semibold text-sm mb-2">
                        <div style={{ color: watchedValues.invoiceAccentColor }}>Description</div>
                        <div style={{ color: watchedValues.invoiceAccentColor }}>Hours</div>
                        <div style={{ color: watchedValues.invoiceAccentColor }}>Rate</div>
                        <div style={{ color: watchedValues.invoiceAccentColor }} className="text-right">Amount</div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>Web Development</div>
                        <div>8.5</div>
                        <div>{watchedValues.displayCurrency}75.00</div>
                        <div className="text-right">{watchedValues.displayCurrency}637.50</div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <div className="text-right">
                        <div className="text-lg font-bold" style={{ color: watchedValues.invoiceColorTheme }}>
                          Total: {watchedValues.displayCurrency}637.50
                        </div>
                      </div>
                    </div>

                    {watchedValues.invoiceFooterText && (
                      <div className="text-center text-sm border-t pt-4 mt-8">
                        {watchedValues.invoiceFooterText}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Save Button */}
          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSubmitting ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}