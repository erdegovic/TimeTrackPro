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
import { Loader2, Save, Upload, X, Palette, Eye, FileText, Building } from "lucide-react";
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

export default function SettingsPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("business");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
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
      };
      
      form.reset(formData);
      
      if (settings.companyLogo) {
        setLogoPreview(settings.companyLogo);
      }
    }
  }, [settings, form]);

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
                Customization
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
                    
                    {form.watch("enableTax") && (
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

            {/* Customization Tab */}
            <TabsContent value="customization" className="space-y-6">
              {/* Logo Upload */}
              <Card>
                <CardHeader>
                  <CardTitle>Company Logo</CardTitle>
                  <CardDescription>
                    Upload your company logo to appear on invoices
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="showLogo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Show Logo on Invoices</FormLabel>
                          <div className="text-sm text-gray-600">
                            Display your company logo on generated invoices
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

                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Logo
                      </Button>
                      <p className="text-sm text-gray-600">
                        Supported formats: PNG, JPG, GIF (max 2MB)
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />

                    {logoPreview && (
                      <div className="relative inline-block">
                        <img
                          src={logoPreview}
                          alt="Company Logo Preview"
                          className="max-w-xs max-h-32 object-contain border rounded"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={removeLogo}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Color Themes */}
              <Card>
                <CardHeader>
                  <CardTitle>Color Palette</CardTitle>
                  <CardDescription>
                    Choose or customize colors for your invoice design
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Predefined Palettes */}
                  <div>
                    <Label className="text-base font-medium">Quick Color Palettes</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                      {colorPalettes.map((palette) => (
                        <Button
                          key={palette.name}
                          type="button"
                          variant="outline"
                          onClick={() => applyColorPalette(palette)}
                          className="h-auto p-3 flex flex-col items-start gap-2"
                        >
                          <div className="flex gap-1">
                            <div 
                              className="w-4 h-4 rounded-full border" 
                              style={{ backgroundColor: palette.primary }} 
                            />
                            <div 
                              className="w-4 h-4 rounded-full border" 
                              style={{ backgroundColor: palette.accent }} 
                            />
                            <div 
                              className="w-4 h-4 rounded-full border" 
                              style={{ backgroundColor: palette.text }} 
                            />
                          </div>
                          <span className="text-xs font-medium">{palette.name}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Custom Colors */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Custom Colors</Label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="invoiceColorTheme"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Color</FormLabel>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input {...field} type="color" className="w-16 h-10 p-1 cursor-pointer" />
                              </FormControl>
                              <FormControl>
                                <Input {...field} placeholder="#1f2937" className="flex-1" />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="invoiceAccentColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Accent Color</FormLabel>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input {...field} type="color" className="w-16 h-10 p-1 cursor-pointer" />
                              </FormControl>
                              <FormControl>
                                <Input {...field} placeholder="#3b82f6" className="flex-1" />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="invoiceTextColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Text Color</FormLabel>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input {...field} type="color" className="w-16 h-10 p-1 cursor-pointer" />
                              </FormControl>
                              <FormControl>
                                <Input {...field} placeholder="#374151" className="flex-1" />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="invoiceBackgroundColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Background Color</FormLabel>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input {...field} type="color" className="w-16 h-10 p-1 cursor-pointer" />
                              </FormControl>
                              <FormControl>
                                <Input {...field} placeholder="#ffffff" className="flex-1" />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Template and Typography */}
              <Card>
                <CardHeader>
                  <CardTitle>Template & Typography</CardTitle>
                  <CardDescription>
                    Customize the overall look and typography of your invoices
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="invoiceTemplate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Template</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="customFontSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Font Size (px)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min="8" max="24" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="invoiceFooterText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Footer Text</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Thank you for your business! Payment is due within 30 days."
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <Label className="text-base font-medium">Display Options</Label>
                    
                    <FormField
                      control={form.control}
                      name="showCompanyDetails"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Show Company Details</FormLabel>
                            <div className="text-sm text-gray-600">
                              Display your company information on invoices
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
                    
                    <FormField
                      control={form.control}
                      name="showBankDetails"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Show Bank Details</FormLabel>
                            <div className="text-sm text-gray-600">
                              Display banking information for payments
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
                  </div>
                </CardContent>
              </Card>
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
                      backgroundColor: form.watch("invoiceBackgroundColor"),
                      color: form.watch("invoiceTextColor"),
                      fontSize: `${form.watch("customFontSize")}px`
                    }}
                  >
                    {/* Invoice Header */}
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        {form.watch("showLogo") && logoPreview && (
                          <img 
                            src={logoPreview} 
                            alt="Company Logo" 
                            className="max-h-16 mb-4"
                          />
                        )}
                        {form.watch("showCompanyDetails") && (
                          <div>
                            <h2 
                              className="text-xl font-bold"
                              style={{ color: form.watch("invoiceColorTheme") }}
                            >
                              {form.watch("businessName") || "Your Business Name"}
                            </h2>
                            <div className="text-sm">
                              {form.watch("businessAddress") && <div>{form.watch("businessAddress")}</div>}
                              <div>
                                {[form.watch("businessCity"), form.watch("businessState"), form.watch("businessZipCode")]
                                  .filter(Boolean).join(", ")}
                              </div>
                              {form.watch("businessEmail") && <div>{form.watch("businessEmail")}</div>}
                              {form.watch("businessPhone") && <div>{form.watch("businessPhone")}</div>}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <h1 
                          className="text-2xl font-bold"
                          style={{ color: form.watch("invoiceColorTheme") }}
                        >
                          INVOICE
                        </h1>
                        <div className="text-sm">
                          <div>Invoice #: {form.watch("nextInvoiceNumber")}</div>
                          <div>Date: {new Date().toLocaleDateString()}</div>
                          {form.watch("showDueDate") && (
                            <div>Due: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sample invoice content */}
                    <div className="border-t border-b py-4 my-4">
                      <div className="grid grid-cols-4 gap-4 font-semibold text-sm">
                        <div style={{ color: form.watch("invoiceAccentColor") }}>Description</div>
                        <div style={{ color: form.watch("invoiceAccentColor") }}>Hours</div>
                        <div style={{ color: form.watch("invoiceAccentColor") }}>Rate</div>
                        <div style={{ color: form.watch("invoiceAccentColor") }} className="text-right">Amount</div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm mt-2">
                        <div>Web Development</div>
                        <div>8.5</div>
                        <div>{form.watch("displayCurrency")}75.00</div>
                        <div className="text-right">{form.watch("displayCurrency")}637.50</div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <div className="text-right">
                        <div className="text-lg font-bold" style={{ color: form.watch("invoiceColorTheme") }}>
                          Total: {form.watch("displayCurrency")}637.50
                        </div>
                      </div>
                    </div>

                    {form.watch("showBankDetails") && (form.watch("bankName") || form.watch("bankAccountNumber")) && (
                      <div className="mt-6 p-4 bg-gray-50 rounded">
                        <h3 className="font-semibold text-sm" style={{ color: form.watch("invoiceAccentColor") }}>
                          Payment Details
                        </h3>
                        <div className="text-sm">
                          {form.watch("bankName") && <div>Bank: {form.watch("bankName")}</div>}
                          {form.watch("bankAccountName") && <div>Account Name: {form.watch("bankAccountName")}</div>}
                          {form.watch("bankAccountNumber") && <div>Account: {form.watch("bankAccountNumber")}</div>}
                          {form.watch("bankSortCode") && <div>Sort Code: {form.watch("bankSortCode")}</div>}
                        </div>
                      </div>
                    )}

                    {form.watch("invoiceFooterText") && (
                      <div className="mt-6 text-center text-sm border-t pt-4">
                        {form.watch("invoiceFooterText")}
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