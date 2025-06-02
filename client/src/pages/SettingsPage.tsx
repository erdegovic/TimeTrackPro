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
  invoiceTemplate: z.enum([
    "luxury", "technology", "coding", "video-production", "graphic-design", 
    "accounting", "education", "hr-recruitment", "engineering", "health-wellness", 
    "cyberpunk", "minimalist", "classic"
  ]),
  
  // Report Settings
  enableWeeklyCategorization: z.boolean().default(true),
  showDateColumn: z.boolean().default(true),
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
  luxury: {
    containerClass: "bg-gradient-to-br from-amber-50 via-white to-amber-50 border-4 border-amber-400 shadow-2xl",
    headerStyle: "bg-gradient-to-r from-amber-600 to-amber-700 text-white text-center py-12 relative",
    titleSize: "text-5xl font-light tracking-widest",
    titleDecoration: "after:content-[''] after:absolute after:bottom-4 after:left-1/2 after:transform after:-translate-x-1/2 after:w-24 after:h-1 after:bg-white after:rounded",
    billingStyle: "grid grid-cols-2 gap-8 p-8 bg-amber-50/30",
    tableStyle: "border-2 border-amber-300 bg-gradient-to-br from-white to-amber-50/20",
    tableHeaderStyle: "bg-gradient-to-r from-amber-600 to-amber-700 text-white text-center font-bold",
    totalStyle: "bg-gradient-to-r from-amber-100 to-amber-200 border-t-4 border-amber-600 p-6",
    accentColor: "#d97706",
    footerStyle: "bg-amber-900 text-white text-center py-6",
    layoutClass: "luxury-premium"
  },
  technology: {
    containerClass: "bg-slate-900 text-white border border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.3)]",
    headerStyle: "bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-8 border-b-2 border-blue-400 relative",
    titleSize: "text-4xl font-bold tracking-wide",
    titleDecoration: "before:content-['<'] after:content-['/>'] before:text-blue-300 after:text-blue-300 before:mr-2 after:ml-2",
    billingStyle: "grid grid-cols-2 gap-6 p-8 bg-slate-800/50 border-y border-slate-700",
    tableStyle: "border border-slate-600 bg-slate-800/30",
    tableHeaderStyle: "bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold",
    totalStyle: "bg-slate-800 border-t-2 border-blue-500 p-6",
    accentColor: "#3b82f6",
    footerStyle: "bg-slate-900 border-t border-blue-500 text-center py-4",
    layoutClass: "tech-futuristic"
  },
  coding: {
    containerClass: "bg-black text-green-400 border border-green-500 font-mono shadow-[0_0_30px_rgba(34,197,94,0.2)]",
    headerStyle: "border-b border-green-500 p-6 relative overflow-hidden",
    titleSize: "text-3xl font-bold",
    titleDecoration: "before:content-['// '] after:content-[' //'] before:text-green-600 after:text-green-600",
    billingStyle: "grid grid-cols-2 gap-6 p-6 border-b border-green-700",
    tableStyle: "border border-green-600 bg-gray-900/50",
    tableHeaderStyle: "bg-green-800 text-green-100 font-mono text-sm",
    totalStyle: "bg-gray-900 border-t-2 border-green-500 p-6 font-mono",
    accentColor: "#22c55e",
    footerStyle: "bg-black border-t border-green-500 text-center py-4 text-green-600",
    layoutClass: "terminal-style"
  },
  "video-production": {
    containerClass: "bg-white shadow-2xl rounded-lg overflow-hidden relative",
    headerStyle: "bg-gradient-to-r from-red-700 to-red-800 p-10 relative",
    titleSize: "text-4xl font-bold text-white",
    titleDecoration: "before:content-['▶'] before:text-red-200 before:mr-3 before:text-5xl",
    billingStyle: "grid grid-cols-2 gap-8 p-8 bg-red-50/30",
    tableStyle: "border border-red-300 bg-white",
    tableHeaderStyle: "bg-red-800 text-white font-semibold text-center",
    totalStyle: "bg-gradient-to-r from-red-50 to-red-100 border-t-4 border-red-600 p-6",
    accentColor: "#dc2626",
    footerStyle: "bg-red-900 text-white text-center py-6",
    layoutClass: "cinematic-style"
  },
  "graphic-design": {
    containerClass: "bg-white shadow-xl rounded-2xl overflow-hidden relative border-4 border-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 p-1",
    headerStyle: "bg-gradient-to-45deg from-purple-600 via-pink-500 to-purple-700 p-8 text-white",
    titleSize: "text-4xl font-extrabold",
    titleDecoration: "bg-gradient-to-r from-pink-300 to-purple-300 bg-clip-text text-transparent",
    billingStyle: "grid grid-cols-2 gap-8 p-8 bg-gradient-to-br from-purple-50 to-pink-50",
    tableStyle: "border-2 border-purple-300 bg-white rounded-lg overflow-hidden",
    tableHeaderStyle: "bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold",
    totalStyle: "bg-gradient-to-r from-purple-100 to-pink-100 border-t-4 border-purple-500 p-6",
    accentColor: "#a855f7",
    footerStyle: "bg-gradient-to-r from-purple-800 to-pink-800 text-white text-center py-6",
    layoutClass: "creative-artistic"
  },
  accounting: {
    containerClass: "bg-white shadow-lg border-2 border-slate-300 rounded-lg",
    headerStyle: "bg-slate-50 border-b-2 border-slate-800 p-8",
    titleSize: "text-3xl font-semibold text-slate-800",
    titleDecoration: "border-b-4 border-blue-600 inline-block pb-2",
    billingStyle: "grid grid-cols-2 gap-8 p-8 bg-slate-50/50",
    tableStyle: "border-2 border-slate-400 bg-white",
    tableHeaderStyle: "bg-slate-800 text-white font-semibold",
    totalStyle: "bg-slate-100 border-t-4 border-slate-800 p-6",
    accentColor: "#475569",
    footerStyle: "bg-slate-800 text-white text-center py-4",
    layoutClass: "professional-formal"
  },
  education: {
    containerClass: "bg-white shadow-lg rounded-xl border-l-8 border-purple-500 overflow-hidden",
    headerStyle: "bg-gradient-to-r from-purple-50 to-blue-50 p-8 border-b border-purple-200",
    titleSize: "text-4xl font-medium text-purple-700",
    titleDecoration: "bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent",
    billingStyle: "grid grid-cols-2 gap-8 p-8 bg-purple-50/30",
    tableStyle: "border border-purple-300 bg-white rounded-lg overflow-hidden",
    tableHeaderStyle: "bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium",
    totalStyle: "bg-gradient-to-r from-purple-50 to-blue-50 border-t-4 border-purple-500 p-6",
    accentColor: "#7c3aed",
    footerStyle: "bg-purple-700 text-white text-center py-6",
    layoutClass: "academic-modern"
  },
  "hr-recruitment": {
    containerClass: "bg-white shadow-lg rounded-lg border-t-4 border-teal-500",
    headerStyle: "bg-teal-50 p-8 border-b border-teal-200",
    titleSize: "text-3xl font-semibold text-teal-800",
    titleDecoration: "border-b-2 border-teal-500 inline-block pb-1",
    billingStyle: "grid grid-cols-2 gap-8 p-8 bg-teal-50/30",
    tableStyle: "border border-teal-300 bg-white",
    tableHeaderStyle: "bg-teal-600 text-white font-semibold",
    totalStyle: "bg-teal-50 border-t-4 border-teal-600 p-6",
    accentColor: "#0d9488",
    footerStyle: "bg-teal-700 text-white text-center py-4",
    layoutClass: "professional-clean"
  },
  engineering: {
    containerClass: "bg-white shadow-xl border-2 border-gray-400 rounded-lg",
    headerStyle: "bg-gray-100 border-b-4 border-gray-700 p-8",
    titleSize: "text-3xl font-bold text-gray-800",
    titleDecoration: "font-mono tracking-wider",
    billingStyle: "grid grid-cols-2 gap-8 p-8 bg-gray-50",
    tableStyle: "border-2 border-gray-500 bg-white",
    tableHeaderStyle: "bg-gray-700 text-white font-bold",
    totalStyle: "bg-gray-100 border-t-4 border-gray-700 p-6",
    accentColor: "#374151",
    footerStyle: "bg-gray-800 text-white text-center py-4",
    layoutClass: "industrial-solid"
  },
  "health-wellness": {
    containerClass: "bg-white shadow-lg rounded-2xl border border-green-200",
    headerStyle: "bg-gradient-to-r from-green-100 to-emerald-100 p-8 rounded-t-2xl",
    titleSize: "text-4xl font-light text-green-800",
    titleDecoration: "tracking-wide",
    billingStyle: "grid grid-cols-2 gap-8 p-8 bg-green-50/30",
    tableStyle: "border border-green-300 bg-white rounded-lg overflow-hidden",
    tableHeaderStyle: "bg-green-600 text-white font-medium",
    totalStyle: "bg-green-50 border-t-4 border-green-500 p-6 rounded-b-lg",
    accentColor: "#059669",
    footerStyle: "bg-green-700 text-white text-center py-6 rounded-b-2xl",
    layoutClass: "wellness-calm"
  },
  cyberpunk: {
    containerClass: "bg-black text-cyan-400 border border-cyan-500 shadow-[0_0_50px_rgba(6,182,212,0.3)] font-mono",
    headerStyle: "bg-gray-900 border-b border-cyan-500 p-6 relative overflow-hidden",
    titleSize: "text-4xl font-bold",
    titleDecoration: "before:content-['{{'] after:content-['}}'] before:text-cyan-600 after:text-cyan-600 before:mr-2 after:ml-2 text-shadow-glow",
    billingStyle: "grid grid-cols-2 gap-6 p-6 bg-gray-900/50 border-y border-cyan-700",
    tableStyle: "border border-cyan-600 bg-gray-900/30",
    tableHeaderStyle: "bg-cyan-900 text-cyan-100 font-mono uppercase tracking-wider",
    totalStyle: "bg-black border-t-2 border-cyan-500 p-6",
    accentColor: "#06b6d4",
    footerStyle: "bg-black border-t border-cyan-500 text-center py-4",
    layoutClass: "futuristic-neon"
  },
  minimalist: {
    containerClass: "bg-white shadow-sm border border-gray-200",
    headerStyle: "p-8 border-b border-gray-200",
    titleSize: "text-2xl font-light text-gray-900",
    titleDecoration: "tracking-wide",
    billingStyle: "grid grid-cols-2 gap-8 p-8",
    tableStyle: "border-collapse border-gray-200",
    tableHeaderStyle: "bg-gray-50 text-gray-700 font-medium border-b border-gray-300",
    totalStyle: "border-t border-gray-300 p-6",
    accentColor: "#6b7280",
    footerStyle: "text-center py-4 text-gray-600",
    layoutClass: "clean-minimal"
  },
  classic: {
    containerClass: "bg-white shadow-lg border-2 border-gray-300",
    headerStyle: "text-center p-10 border-b-4 border-gray-800",
    titleSize: "text-3xl font-serif text-gray-900",
    titleDecoration: "uppercase tracking-widest",
    billingStyle: "grid grid-cols-2 gap-8 p-8",
    tableStyle: "border-2 border-gray-400 bg-white",
    tableHeaderStyle: "bg-gray-800 text-white font-serif",
    totalStyle: "bg-gray-50 border-t-4 border-gray-800 p-6",
    accentColor: "#1f2937",
    footerStyle: "bg-gray-800 text-white text-center py-6",
    layoutClass: "traditional-formal"
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
      invoiceTemplate: "video-production",
      enableWeeklyCategorization: true,
      showDateColumn: true,
    },
  });

  // Watch form values for live preview
  const watchedValues = form.watch();

  // Populate form when settings are loaded
  useEffect(() => {
    if (settings) {
      const formData = {
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
        nextInvoiceNumber: settings.nextInvoiceNumber || 1001,
        defaultTimeFormat: (settings.defaultTimeFormat as "decimal" | "time") || "decimal",
        defaultCurrency: settings.defaultCurrency || "USD",
        displayCurrency: settings.displayCurrency || "USD",
        enableTax: settings.enableTax ?? false,
        defaultTaxRate: settings.defaultTaxRate?.toString() || "0",
        showDueDate: settings.showDueDate ?? true,
        companyLogo: settings.companyLogo || "",
        showLogo: settings.showLogo ?? true,
        invoiceColorTheme: settings.invoiceColorTheme || "#1f2937",
        invoiceAccentColor: settings.invoiceAccentColor || "#3b82f6",
        invoiceTextColor: settings.invoiceTextColor || "#374151",
        invoiceBackgroundColor: settings.invoiceBackgroundColor || "#ffffff",
        customFontSize: settings.customFontSize || "12",
        invoiceFooterText: settings.invoiceFooterText || "",
        showCompanyDetails: settings.showCompanyDetails ?? true,
        showBankDetails: settings.showBankDetails ?? true,
        invoiceTemplate: (settings.invoiceTemplate as any) || "video-production",
        enableWeeklyCategorization: settings.enableWeeklyCategorization ?? true,
        showDateColumn: settings.showDateColumn ?? true,
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

  // Get current template style with fallback
  const getTemplateStyle = (templateName: string) => {
    return templateStyles[templateName as keyof typeof templateStyles] || templateStyles.luxury;
  };
  const currentTemplate = getTemplateStyle(watchedValues.invoiceTemplate || "luxury");

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      console.log("[Settings Frontend] Sending data to API:", data);
      const response = await apiRequest("PUT", "/api/settings", data);
      console.log("[Settings Frontend] API response received:", response);
      return response;
    },
    onSuccess: () => {
      console.log("[Settings Frontend] Update successful");
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully.",
      });
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error("[Settings Frontend] Error updating settings:", error);
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: SettingsFormData) => {
    console.log("[Settings Frontend] Form submitted with data:", data);
    console.log("[Settings Frontend] Form errors:", form.formState.errors);
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

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Report Settings</h3>
                    
                    <FormField
                      control={form.control}
                      name="enableWeeklyCategorization"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Weekly Categorization</FormLabel>
                            <div className="text-sm text-gray-600">
                              Group report entries by weeks within the month. When disabled, all entries are grouped together for the selected date range.
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
                      name="showDateColumn"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Show Date Column</FormLabel>
                            <div className="text-sm text-gray-600">
                              Display the date column in reports. When disabled, dates are hidden to save space when filtering by specific dates.
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
                    {/* Template Selector - First Item */}
                    <div className="mb-4 p-4 bg-white rounded-lg border-2 border-blue-200">
                      <FormField
                        control={form.control}
                        name="invoiceTemplate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold flex items-center gap-2">
                              <Palette className="h-4 w-4" />
                              Invoice Template Style
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-10 text-sm">
                                  <SelectValue placeholder="Select template..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="luxury">Luxury</SelectItem>
                                <SelectItem value="technology">Technology</SelectItem>
                                <SelectItem value="coding">Coding</SelectItem>
                                <SelectItem value="video-production">Video Production</SelectItem>
                                <SelectItem value="graphic-design">Graphic Design</SelectItem>
                                <SelectItem value="accounting">Accounting</SelectItem>
                                <SelectItem value="education">Education</SelectItem>
                                <SelectItem value="hr-recruitment">HR & Recruitment</SelectItem>
                                <SelectItem value="engineering">Engineering & Architecture</SelectItem>
                                <SelectItem value="health-wellness">Health & Wellness</SelectItem>
                                <SelectItem value="cyberpunk">Cyberpunk</SelectItem>
                                <SelectItem value="minimalist">Minimalist</SelectItem>
                                <SelectItem value="classic">Classic</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

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
                                        <SelectItem value="luxury">Luxury</SelectItem>
                                        <SelectItem value="technology">Technology</SelectItem>
                                        <SelectItem value="coding">Coding</SelectItem>
                                        <SelectItem value="video-production">Video Production</SelectItem>
                                        <SelectItem value="graphic-design">Graphic Design</SelectItem>
                                        <SelectItem value="accounting">Accounting</SelectItem>
                                        <SelectItem value="education">Education</SelectItem>
                                        <SelectItem value="hr-recruitment">HR & Recruitment</SelectItem>
                                        <SelectItem value="engineering">Engineering & Architecture</SelectItem>
                                        <SelectItem value="health-wellness">Health & Wellness</SelectItem>
                                        <SelectItem value="cyberpunk">Cyberpunk</SelectItem>
                                        <SelectItem value="minimalist">Minimalist</SelectItem>
                                        <SelectItem value="classic">Classic</SelectItem>
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
                            
                            <div className={watchedValues.invoiceTemplate === "minimalist" ? "text-right" : "text-right"}>
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
                    className="max-w-3xl mx-auto overflow-hidden bg-white shadow-lg"
                    style={{ 
                      fontSize: `${watchedValues.customFontSize}px`
                    }}
                  >
                    {/* Debug - Current template value */}
                    <div className="p-2 bg-yellow-100 text-xs">
                      Current template: {watchedValues.invoiceTemplate || 'undefined'}
                    </div>
                    {/* OLD Video Production Template - DISABLED */}
                    {false && watchedValues.invoiceTemplate === 'video-production' && (
                      <div className="relative">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 to-red-500"></div>
                        
                        <div className="flex justify-between p-10 pt-12 border-b">
                          <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">LUMINA FILMS</h1>
                            <p className="text-gray-600">Cinematic storytelling at its finest</p>
                            <p className="text-gray-600">123 Film Lane, Studio City, CA 91604</p>
                            <p className="text-gray-600">contact@luminafilms.example | (555) 123-4567</p>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-semibold text-red-600 mb-2">INV #LF-2023-108</div>
                            <div className="text-gray-600">Date: November 15, 2023</div>
                            <div className="text-gray-600">Due: December 15, 2023</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 p-10 bg-gray-50">
                          <div>
                            <h3 className="text-red-600 font-semibold text-sm uppercase tracking-wider mb-4">Bill To</h3>
                            <p className="font-bold">Starlight Productions</p>
                            <p>Attn: Sarah Johnson (Producer)</p>
                            <p>890 Cinema Boulevard</p>
                            <p>Los Angeles, CA 90028</p>
                            <p>PO #STAR-2023-42</p>
                          </div>
                          <div>
                            <h3 className="text-red-600 font-semibold text-sm uppercase tracking-wider mb-4">Project Details</h3>
                            <p><strong>Project:</strong> "Midnight Horizon" Commercial</p>
                            <p><strong>Project ID:</strong> PRJ-MH-2309</p>
                            <p><strong>Shot Dates:</strong> Oct 10-15, 2023</p>
                          </div>
                        </div>

                        <div className="h-5 mx-10 bg-gray-900 relative" style={{background: 'repeating-linear-gradient(90deg, #1a1a1a, #1a1a1a 10px, transparent 10px, transparent 30px)'}}>
                          <div className="absolute -left-5 top-0 w-5 h-full bg-gray-900 rounded-l-lg"></div>
                          <div className="absolute -right-5 top-0 w-5 h-full bg-gray-900 rounded-r-lg"></div>
                        </div>

                        <table className="w-full mx-10 my-8 border-collapse" style={{width: 'calc(100% - 5rem)'}}>
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left p-4 font-semibold border-b-2 border-gray-200">Service</th>
                              <th className="text-left p-4 font-semibold border-b-2 border-gray-200">Days/Qty</th>
                              <th className="text-left p-4 font-semibold border-b-2 border-gray-200">Rate</th>
                              <th className="text-left p-4 font-semibold border-b-2 border-gray-200">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-4">
                                <div className="font-bold">Pre-Production</div>
                                <div className="text-red-600 text-sm uppercase tracking-wide">Creative Development</div>
                              </td>
                              <td className="p-4">5</td>
                              <td className="p-4">$1,200.00</td>
                              <td className="p-4">$6,000.00</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-4">
                                <div className="font-bold">Principal Photography</div>
                                <div className="text-red-600 text-sm uppercase tracking-wide">2 Camera Crew</div>
                              </td>
                              <td className="p-4">3</td>
                              <td className="p-4">$3,500.00</td>
                              <td className="p-4">$10,500.00</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-4">
                                <div className="font-bold">Cinematography</div>
                                <div className="text-red-600 text-sm uppercase tracking-wide">ARRI Alexa Package</div>
                              </td>
                              <td className="p-4">3</td>
                              <td className="p-4">$2,800.00</td>
                              <td className="p-4">$8,400.00</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-4">
                                <div className="font-bold">Post-Production</div>
                                <div className="text-red-600 text-sm uppercase tracking-wide">Editing & Color Grading</div>
                              </td>
                              <td className="p-4">10</td>
                              <td className="p-4">$950.00</td>
                              <td className="p-4">$9,500.00</td>
                            </tr>
                            <tr>
                              <td className="p-4">
                                <div className="font-bold">Licensed Music Track</div>
                                <div className="text-red-600 text-sm uppercase tracking-wide">"Neon Dreams" by AudioNetwork</div>
                              </td>
                              <td className="p-4">1</td>
                              <td className="p-4">$1,200.00</td>
                              <td className="p-4">$1,200.00</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Coding Template with Terminal Style */}
                    {watchedValues.invoiceTemplate === 'coding' && (
                      <div className="bg-black text-green-400 p-6 font-mono">
                        <div className="border-b border-green-600 pb-4 mb-4">
                          <div className="text-green-500 text-xs mb-2">// DEVHACK SYSTEMS - INVOICE</div>
                          <div className="flex justify-between">
                            <div>
                              <h1 className="text-2xl font-bold text-green-400">
                                // {watchedValues.businessName || "DEVHACK SYSTEMS"} //
                              </h1>
                              <div className="text-green-600 text-sm mt-2">
                                <div>// Cutting-edge development solutions</div>
                                <div>// {watchedValues.businessEmail}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-blue-400 text-lg">INVOICE #{watchedValues.nextInvoiceNumber}</div>
                              <div className="text-green-600 text-sm">
                                <div>Date: {new Date().toLocaleDateString()}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6 text-sm">
                          <div>
                            <div className="text-green-400 mb-2">CLIENT_INFO</div>
                            <div className="ml-4 space-y-1">
                              <div>name: "Sample Client"</div>
                              <div>address: "123 Tech Street"</div>
                              <div>email: "client@techcorp.com"</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-green-400 mb-2">PROJECT_META</div>
                            <div className="ml-4 space-y-1">
                              <div>status: "completed"</div>
                              <div>framework: "React.js"</div>
                              <div>deployment: "AWS"</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Default Template for Other Types */}
                    {!['video-production', 'coding'].includes(watchedValues.invoiceTemplate || '') && (
                      <div className={currentTemplate.headerStyle}>
                        <div className="flex justify-between items-start w-full">
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
                                <h2 className={`${currentTemplate.titleSize} ${currentTemplate.titleDecoration}`}>
                                  {watchedValues.businessName || "Your Business Name"}
                                </h2>
                                <div className="text-sm mt-2 opacity-90">
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
                            <h1 className="text-3xl font-bold mb-2">
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
                        </div>
                      </div>
                    )}

                    {/* Billing Information */}
                    <div className={currentTemplate.billingStyle}>
                      <div>
                        <h3 className="font-semibold mb-3 text-lg" style={{ color: currentTemplate.accentColor }}>
                          Bill To:
                        </h3>
                        <div className="space-y-1">
                          <div className="font-medium">Sample Client</div>
                          <div className="text-sm">123 Client Street</div>
                          <div className="text-sm">Client City, State 12345</div>
                          <div className="text-sm">client@example.com</div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-semibold mb-3 text-lg" style={{ color: currentTemplate.accentColor }}>
                          Ship To:
                        </h3>
                        <div className="space-y-1">
                          <div className="font-medium">Same as billing</div>
                        </div>
                      </div>
                    </div>

                    {/* Video Production Services Table */}
                    {watchedValues.invoiceTemplate === 'video-production' && (
                      <div className="p-8">
                        {/* Film Strip Border */}
                        <div className="bg-black h-8 flex items-center justify-center mb-6">
                          <div className="flex space-x-2">
                            {[...Array(25)].map((_, i) => (
                              <div key={i} className="w-2 h-4 bg-gray-600"></div>
                            ))}
                          </div>
                        </div>
                        
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="text-left p-4 font-semibold">Service</th>
                              <th className="text-center p-4 font-semibold">Days/Qty</th>
                              <th className="text-center p-4 font-semibold">Rate</th>
                              <th className="text-right p-4 font-semibold">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-4">
                                <div className="font-medium">Pre-Production</div>
                                <div className="text-red-600 text-sm">CREATIVE DEVELOPMENT</div>
                              </td>
                              <td className="text-center p-4">5</td>
                              <td className="text-center p-4">$1,200.00</td>
                              <td className="text-right p-4">$6,000.00</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-4">
                                <div className="font-medium">Principal Photography</div>
                                <div className="text-red-600 text-sm">2 CAMERA CREW</div>
                              </td>
                              <td className="text-center p-4">3</td>
                              <td className="text-center p-4">$3,500.00</td>
                              <td className="text-right p-4">$10,500.00</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-4">
                                <div className="font-medium">Cinematography</div>
                                <div className="text-red-600 text-sm">ARRI ALEXA PACKAGE</div>
                              </td>
                              <td className="text-center p-4">3</td>
                              <td className="text-center p-4">$2,800.00</td>
                              <td className="text-right p-4">$8,400.00</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-4">
                                <div className="font-medium">Post-Production</div>
                                <div className="text-red-600 text-sm">EDITING & COLOR GRADING</div>
                              </td>
                              <td className="text-center p-4">10</td>
                              <td className="text-center p-4">$950.00</td>
                              <td className="text-right p-4">$9,500.00</td>
                            </tr>
                            <tr>
                              <td className="p-4">
                                <div className="font-medium">Licensed Music Track</div>
                                <div className="text-red-600 text-sm">"NEON DREAMS" BY AUDIONETWORK</div>
                              </td>
                              <td className="text-center p-4">1</td>
                              <td className="text-center p-4">$1,200.00</td>
                              <td className="text-right p-4">$1,200.00</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Coding Template Services */}
                    {watchedValues.invoiceTemplate === 'coding' && (
                      <div className="bg-black text-green-400 p-6 font-mono">
                        <div className="text-green-500 text-sm mb-4">// SERVICES_ARRAY</div>
                        <div className="space-y-3 text-sm">
                          <div className="grid grid-cols-4 gap-4 border-b border-green-800 pb-2">
                            <div className="text-green-400">SERVICE</div>
                            <div className="text-center text-green-400">HOURS</div>
                            <div className="text-center text-green-400">RATE</div>
                            <div className="text-right text-green-400">TOTAL</div>
                          </div>
                          <div className="grid grid-cols-4 gap-4 py-2">
                            <div>frontend_development()</div>
                            <div className="text-center">120</div>
                            <div className="text-center">$85.00</div>
                            <div className="text-right">$10,200.00</div>
                          </div>
                          <div className="grid grid-cols-4 gap-4 py-2">
                            <div>api_integration()</div>
                            <div className="text-center">40</div>
                            <div className="text-center">$95.00</div>
                            <div className="text-right">$3,800.00</div>
                          </div>
                          <div className="grid grid-cols-4 gap-4 py-2">
                            <div>database_optimization()</div>
                            <div className="text-center">25</div>
                            <div className="text-center">$110.00</div>
                            <div className="text-right">$2,750.00</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Default Services Table */}
                    {!['video-production', 'coding'].includes(watchedValues.invoiceTemplate || '') && (
                      <div className={`${currentTemplate.tableStyle} mb-8`}>
                        <div className={`${currentTemplate.tableHeaderStyle} p-4`}>
                          <div className="grid grid-cols-4 gap-4 font-semibold">
                            <div>Description</div>
                            <div className="text-center">Hours</div>
                            <div className="text-center">Rate</div>
                            <div className="text-right">Amount</div>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="grid grid-cols-4 gap-4 py-3 border-b border-gray-200">
                            <div>Web Development</div>
                            <div className="text-center">8.5</div>
                            <div className="text-center">{watchedValues.displayCurrency}75.00</div>
                            <div className="text-right">{watchedValues.displayCurrency}637.50</div>
                          </div>
                          <div className="grid grid-cols-4 gap-4 py-3 border-b border-gray-200">
                            <div>UI/UX Design</div>
                            <div className="text-center">4.0</div>
                            <div className="text-center">{watchedValues.displayCurrency}85.00</div>
                            <div className="text-right">{watchedValues.displayCurrency}340.00</div>
                          </div>
                          <div className="grid grid-cols-4 gap-4 py-3">
                            <div>Project Management</div>
                            <div className="text-center">2.5</div>
                            <div className="text-center">{watchedValues.displayCurrency}65.00</div>
                            <div className="text-right">{watchedValues.displayCurrency}162.50</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Video Production Total Section */}
                    {watchedValues.invoiceTemplate === 'video-production' && (
                      <div className="p-8 bg-gray-50">
                        <div className="flex justify-end">
                          <div className="w-80 space-y-2">
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span>$35,600.00</span>
                            </div>
                            <div className="flex justify-between text-red-600">
                              <span>Equipment Discount (10%):</span>
                              <span>-$3,560.00</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Tax (8.5%):</span>
                              <span>$2,723.40</span>
                            </div>
                            <div className="flex justify-between text-2xl font-bold border-t-2 border-red-600 pt-2 text-red-600">
                              <span>TOTAL DUE:</span>
                              <span>$34,763.40</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-8 text-sm space-y-2">
                          <div><strong>Payment Terms:</strong> Net 30. Late fees of 1.5% monthly will apply after due date.</div>
                          <div><strong>Payment Methods:</strong> Bank transfer, check, or credit card (+3% fee).</div>
                          <div><strong>Bank Details:</strong> Chase Bank | Routing #021000021 | Account #987654321</div>
                        </div>
                        
                        <div className="mt-8 text-center text-sm border-t pt-4">
                          <div>Thank you for choosing <strong>Lumina Films!</strong></div>
                          <div>Questions? Email accounting@luminafilms.example</div>
                          <div className="text-xs text-gray-600 mt-2">© 2023 Lumina Films | All rights reserved</div>
                        </div>
                      </div>
                    )}

                    {/* Coding Template Total */}
                    {watchedValues.invoiceTemplate === 'coding' && (
                      <div className="bg-black text-green-400 p-6 font-mono">
                        <div className="text-green-500 text-sm mb-4">// INVOICE_TOTALS</div>
                        <div className="text-right space-y-1">
                          <div>subtotal: $16,750.00</div>
                          <div>tax_rate: 0.0825</div>
                          <div>tax_amount: $1,381.88</div>
                          <div className="border-t border-green-600 pt-2 text-lg font-bold">
                            total_due: $18,131.88
                          </div>
                        </div>
                        
                        <div className="mt-6 text-xs text-green-600 border-t border-green-800 pt-4">
                          <div>// Payment via crypto preferred (BTC/ETH)</div>
                          <div>// Traditional banking also accepted</div>
                          <div>// contact@devhacksystems.dev</div>
                        </div>
                      </div>
                    )}

                    {/* Default Total Section */}
                    {!['video-production', 'coding'].includes(watchedValues.invoiceTemplate || '') && (
                      <div className={currentTemplate.totalStyle}>
                        <div className="flex justify-end">
                          <div className="w-80 space-y-2">
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span>{watchedValues.displayCurrency}1,140.00</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Tax (10%):</span>
                              <span>{watchedValues.displayCurrency}114.00</span>
                            </div>
                            <div className="flex justify-between text-xl font-bold border-t pt-2" style={{ color: currentTemplate.accentColor }}>
                              <span>Total:</span>
                              <span>{watchedValues.displayCurrency}1,254.00</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payment Information */}
                    {(watchedValues.bankName || watchedValues.invoiceFooterText) && (
                      <div className="mt-8 space-y-4">
                        {watchedValues.bankName && (
                          <div className="border-t pt-4">
                            <h4 className="font-semibold mb-2" style={{ color: currentTemplate.accentColor }}>
                              Payment Information
                            </h4>
                            <div className="text-sm space-y-1">
                              {watchedValues.bankName && <div>Bank: {watchedValues.bankName}</div>}
                              {watchedValues.bankAccountName && <div>Account Name: {watchedValues.bankAccountName}</div>}
                              {watchedValues.bankAccountNumber && <div>Account: {watchedValues.bankAccountNumber}</div>}
                              {watchedValues.bankSortCode && <div>Sort Code: {watchedValues.bankSortCode}</div>}
                            </div>
                          </div>
                        )}
                        
                        {watchedValues.invoiceFooterText && (
                          <div className={currentTemplate.footerStyle}>
                            {watchedValues.invoiceFooterText}
                          </div>
                        )}
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
              type="button"
              disabled={isSubmitting}
              className="flex items-center gap-2"
              onClick={() => {
                console.log("[Settings Frontend] Button clicked, form state:", {
                  isValid: form.formState.isValid,
                  errors: form.formState.errors,
                  values: form.getValues()
                });
                
                // Try to submit manually to bypass form validation issues
                const currentValues = form.getValues();
                console.log("[Settings Frontend] Manual submit with values:", currentValues);
                setIsSubmitting(true);
                updateSettingsMutation.mutate(currentValues);
              }}
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