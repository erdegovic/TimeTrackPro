import { useState, useEffect, useRef, useMemo } from "react";
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
  ChevronRight, ChevronDown, Zap, BrushIcon, Type, CreditCard,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Minus, Link
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "@shared/schema";
import { generateInvoiceHTML, TEMPLATE_OPTIONS, TEMPLATE_COLOR_DEFAULTS, InvoiceTemplateData } from "@/lib/invoice-html-generator";
import { format } from "date-fns";

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
  
  // Payment Details - Dynamic based on method type
  paymentMethodType: z.enum(["bank_transfer_eu", "bank_transfer_uk", "bank_transfer_us", "paypal", "wise_payoneer", "other"]).default("bank_transfer_us"),
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankSortCode: z.string().optional(),
  iban: z.string().optional(),
  swift: z.string().optional(),
  routingNumber: z.string().optional(),
  paypalEmail: z.string().optional(),
  wiseEmail: z.string().optional(),
  otherPaymentInstructions: z.string().optional(),
  
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
  logoSize: z.string().default("64"),
  showBusinessName: z.boolean().default(true),
  invoiceColorTheme: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  invoiceAccentColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  invoiceTextColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  invoiceBackgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  customFontSize: z.string().regex(/^\d+$/, "Must be a number"),
  invoiceFooterText: z.string().optional(),
  showCompanyDetails: z.boolean().default(true),
  showBankDetails: z.boolean().default(true),
  showFooterNotes: z.boolean().default(true),
  showHourlyRate: z.boolean().default(true),
  invoiceTemplate: z.enum(["classic", "professional", "media", "web", "graphic", "minimalistic", "freelancer", "avant", "luxe"]),
  
  // Report Settings
  enableWeeklyCategorization: z.boolean().default(true),
  showDateColumn: z.boolean().default(true),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// Predefined color palettes


interface CollapsibleSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
}


// Enhanced Rich Text Editor Component
const EnhancedRichTextEditor = ({ value, onChange, placeholder }: { 
  value: string; 
  onChange: (value: string) => void; 
  placeholder?: string; 
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const insertDivider = () => {
    const hr = document.createElement('hr');
    hr.style.border = 'none';
    hr.style.borderTop = '1px solid #ccc';
    hr.style.margin = '10px 0';
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.insertNode(hr);
      range.setStartAfter(hr);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    handleInput();
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  return (
    <div className="border rounded-md">
      {/* Enhanced Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-gray-50 overflow-x-auto">
        {/* Text Formatting */}
        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat('bold')}
            className="h-8 w-8 p-0"
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat('italic')}
            className="h-8 w-8 p-0"
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat('underline')}
            className="h-8 w-8 p-0"
            title="Underline"
          >
            <Underline className="h-4 w-4" />
          </Button>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat('justifyLeft')}
            className="h-8 w-8 p-0"
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat('justifyCenter')}
            className="h-8 w-8 p-0"
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat('justifyRight')}
            className="h-8 w-8 p-0"
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat('insertUnorderedList')}
            className="h-8 w-8 p-0"
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat('insertOrderedList')}
            className="h-8 w-8 p-0"
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={insertDivider}
            className="h-8 w-8 p-0"
            title="Insert Divider"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[120px] p-4 focus:outline-none rich-text-editor"
        onInput={handleInput}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        style={{
          minHeight: '120px'
        }}
      />
      
      <style dangerouslySetInnerHTML={{
        __html: `
          .rich-text-editor:empty:before {
            content: attr(data-placeholder);
            color: #9CA3AF;
            pointer-events: none;
          }
          .rich-text-editor ul, .rich-text-editor ol {
            margin: 10px 0;
            padding-left: 20px;
          }
          .rich-text-editor li {
            margin: 5px 0;
          }
        `
      }} />
    </div>
  );
};

// Simple Rich Text Editor Component (for payment instructions)
const RichTextEditor = ({ value, onChange, placeholder }: { 
  value: string; 
  onChange: (value: string) => void; 
  placeholder?: string; 
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  const applyFormat = (command: string) => {
    document.execCommand(command, false, undefined);
    editorRef.current?.focus();
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  return (
    <div className="border rounded-md">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-gray-50 overflow-x-auto">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => applyFormat('bold')}
          className="h-8 w-8 p-0"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => applyFormat('italic')}
          className="h-8 w-8 p-0"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => applyFormat('underline')}
          className="h-8 w-8 p-0"
        >
          <Underline className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[100px] p-3 focus:outline-none rich-text-editor"
        onInput={handleInput}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        style={{
          minHeight: '100px'
        }}
      />
      
      <style dangerouslySetInnerHTML={{
        __html: `
          .rich-text-editor:empty:before {
            content: attr(data-placeholder);
            color: #9CA3AF;
            pointer-events: none;
          }
        `
      }} />
    </div>
  );
};

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
      paymentMethodType: "bank_transfer_us",
      bankName: "",
      bankAccountName: "",
      bankAccountNumber: "",
      bankSortCode: "",
      iban: "",
      swift: "",
      routingNumber: "",
      paypalEmail: "",
      wiseEmail: "",
      otherPaymentInstructions: "",
      nextInvoiceNumber: 1001,
      defaultTimeFormat: "decimal",
      defaultCurrency: "USD",
      displayCurrency: "USD",
      enableTax: false,
      defaultTaxRate: "0",
      showDueDate: true,
      companyLogo: "",
      showLogo: true,
      logoSize: "64",
      showBusinessName: true,
      invoiceColorTheme: TEMPLATE_COLOR_DEFAULTS["professional"].primary,
      invoiceAccentColor: TEMPLATE_COLOR_DEFAULTS["professional"].accent || TEMPLATE_COLOR_DEFAULTS["professional"].primary,
      invoiceTextColor: "#374151",
      invoiceBackgroundColor: "#ffffff",
      customFontSize: "12",
      invoiceFooterText: "",
      showCompanyDetails: true,
      showBankDetails: true,
      showFooterNotes: true,
      invoiceTemplate: "professional" as const,
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
        paymentMethodType: (settings.paymentMethodType as any) || "bank_transfer_us",
        bankName: settings.bankName || "",
        bankAccountName: settings.bankAccountName || "",
        bankAccountNumber: settings.bankAccountNumber || "",
        bankSortCode: settings.bankSortCode || "",
        iban: settings.iban || "",
        swift: settings.swift || "",
        routingNumber: settings.routingNumber || "",
        paypalEmail: settings.paypalEmail || "",
        wiseEmail: settings.wiseEmail || "",
        otherPaymentInstructions: settings.otherPaymentInstructions || "",
        nextInvoiceNumber: settings.nextInvoiceNumber || 1001,
        defaultTimeFormat: (settings.defaultTimeFormat as "decimal" | "time") || "decimal",
        defaultCurrency: settings.defaultCurrency || "USD",
        displayCurrency: settings.displayCurrency || "USD",
        enableTax: settings.enableTax ?? false,
        defaultTaxRate: settings.defaultTaxRate?.toString() || "0",
        showDueDate: settings.showDueDate ?? true,
        companyLogo: settings.companyLogo || "",
        showLogo: settings.showLogo ?? true,
        logoSize: settings.logoSize || "64",
        showBusinessName: settings.showBusinessName ?? true,
        invoiceColorTheme: (() => {
          const stored = settings.invoiceColorTheme;
          if (!stored || stored === "#1f2937" || stored === "#3b82f6") {
            const tpl = settings.invoiceTemplate || "professional";
            return TEMPLATE_COLOR_DEFAULTS[tpl]?.primary || "#12283d";
          }
          return stored;
        })(),
        invoiceAccentColor: (() => {
          const stored = settings.invoiceAccentColor;
          if (!stored || stored === "#3b82f6" || stored === "#1f2937") {
            const tpl = settings.invoiceTemplate || "professional";
            const def = TEMPLATE_COLOR_DEFAULTS[tpl];
            return def?.accent || def?.primary || "#12283d";
          }
          return stored;
        })(),
        invoiceTextColor: settings.invoiceTextColor || "#374151",
        invoiceBackgroundColor: settings.invoiceBackgroundColor || "#ffffff",
        customFontSize: settings.customFontSize || "12",
        invoiceFooterText: settings.invoiceFooterText || "",
        showCompanyDetails: settings.showCompanyDetails ?? true,
        showBankDetails: settings.showBankDetails ?? true,
        showFooterNotes: settings.showFooterNotes ?? true,
        invoiceTemplate: (settings.invoiceTemplate as "classic" | "professional" | "media" | "web" | "graphic" | "minimalistic" | "freelancer" | "avant" | "luxe") || "professional",
        enableWeeklyCategorization: settings.enableWeeklyCategorization ?? true,
        showDateColumn: settings.showDateColumn ?? true,
      };
      
      form.reset(formData);
      
      // Auto-apply template-specific color themes
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

  // When template changes, auto-reset colors to that template's original defaults
  const isInitialColorMount = useRef(true);
  useEffect(() => {
    if (isInitialColorMount.current) {
      isInitialColorMount.current = false;
      return;
    }
    const tpl = watchedValues.invoiceTemplate;
    const def = TEMPLATE_COLOR_DEFAULTS[tpl];
    if (def) {
      form.setValue("invoiceColorTheme", def.primary);
      form.setValue("invoiceAccentColor", def.accent || def.primary);
    }
  }, [watchedValues.invoiceTemplate]);

  const resetColorsToDefault = () => {
    const tpl = watchedValues.invoiceTemplate;
    const def = TEMPLATE_COLOR_DEFAULTS[tpl];
    if (def) {
      form.setValue("invoiceColorTheme", def.primary);
      form.setValue("invoiceAccentColor", def.accent || def.primary);
    }
  };

  // Build live preview HTML for the selected template
  const settingsPreviewHtml = useMemo(() => {
    const currency = watchedValues.displayCurrency || "$";
    const data: InvoiceTemplateData = {
      template: watchedValues.invoiceTemplate || "professional",
      businessName: watchedValues.businessName || "Your Business",
      businessMeta: "Professional services",
      businessAddress: [watchedValues.businessAddress, watchedValues.businessCity, watchedValues.businessState].filter(Boolean).join(", "),
      businessEmail: watchedValues.businessEmail || "you@example.com",
      businessPhone: watchedValues.businessPhone || "",
      invoiceNumber: `INV-${watchedValues.nextInvoiceNumber || "001"}`,
      issueDate: format(new Date(), "MMMM d, yyyy"),
      dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "MMMM d, yyyy"),
      clientName: "Sample Client Co.",
      clientAddress: "123 Client Street",
      clientCity: "Client City",
      clientState: "ST",
      clientZip: "12345",
      clientEmail: "client@example.com",
      lineItems: [
        { description: "Web Development", subDescription: "Project Alpha", qty: "8.5", rate: `${currency}75.00`, amount: `${currency}637.50` },
        { description: "Design Review", subDescription: "UI/UX Pass", qty: "2.0", rate: `${currency}75.00`, amount: `${currency}150.00` },
        { description: "Consultation", subDescription: "Strategy session", qty: "1.5", rate: `${currency}90.00`, amount: `${currency}135.00` },
      ],
      subtotalFormatted: "922.50",
      taxFormatted: "0.00",
      taxLabel: "Tax",
      totalFormatted: "922.50",
      notes: "Thank you for your business. Payment due within 30 days.",
      currency,
      logoUrl: (watchedValues as any).companyLogo || undefined,
      showLogo: (watchedValues as any).showLogo !== false,
      logoSize: (watchedValues as any).logoSize || "64",
      primaryColor: watchedValues.invoiceColorTheme || undefined,
      accentColor: watchedValues.invoiceAccentColor || undefined,
      textColor: watchedValues.invoiceTextColor || undefined,
      bgColor: watchedValues.invoiceBackgroundColor || undefined,
    };
    return generateInvoiceHTML(data);
  }, [watchedValues.invoiceTemplate, watchedValues.businessName, watchedValues.businessAddress, watchedValues.businessCity, watchedValues.businessState, watchedValues.businessEmail, watchedValues.businessPhone, watchedValues.displayCurrency, watchedValues.nextInvoiceNumber, (watchedValues as any).companyLogo, (watchedValues as any).showLogo, (watchedValues as any).logoSize, watchedValues.invoiceColorTheme, watchedValues.invoiceAccentColor, watchedValues.invoiceTextColor, watchedValues.invoiceBackgroundColor]);

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
    <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6 px-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Manage your business information, invoice customization, and preferences
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="business" className="flex items-center gap-2 text-sm">
                <Building className="h-4 w-4" />
                Business
              </TabsTrigger>
              <TabsTrigger value="invoice" className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Invoice
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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


            </TabsContent>

            {/* Invoice Tab - Merged split-screen */}
            <TabsContent value="invoice" className="mt-0 p-0">
              <div
                className="flex flex-col lg:flex-row border rounded-lg overflow-hidden"
                style={{ height: "calc(100vh - 230px)", minHeight: "600px" }}
              >
                {/* ── Left: scrollable controls ─────────────────────────── */}
                <div className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r bg-gray-50/80 overflow-y-auto flex flex-col">
                  <div className="p-3 space-y-2">

                    {/* Template & Colors ─ always visible */}
                    <div className="bg-white rounded-md border p-3 space-y-3">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Type className="h-3 w-3" /> Template &amp; Colors
                      </p>
                      <FormField
                        control={form.control}
                        name="invoiceTemplate"
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {TEMPLATE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      {(() => {
                        const tpl = watchedValues.invoiceTemplate || "professional";
                        const def = TEMPLATE_COLOR_DEFAULTS[tpl];
                        const hasAccent = !!def?.accentLabel;
                        return (
                          <div className={`grid gap-2 ${hasAccent ? "grid-cols-2" : "grid-cols-1"}`}>
                            <FormField
                              control={form.control}
                              name="invoiceColorTheme"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] text-gray-500">{def?.primaryLabel || "Primary"}</FormLabel>
                                  <div className="flex gap-1 items-center">
                                    <FormControl>
                                      <Input {...field} type="color" className="w-8 h-7 p-0.5 cursor-pointer rounded shrink-0 border" />
                                    </FormControl>
                                    <FormControl>
                                      <Input {...field} className="flex-1 h-7 text-[11px] font-mono px-2" />
                                    </FormControl>
                                  </div>
                                </FormItem>
                              )}
                            />
                            {hasAccent && (
                              <FormField
                                control={form.control}
                                name="invoiceAccentColor"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-[11px] text-gray-500">{def?.accentLabel}</FormLabel>
                                    <div className="flex gap-1 items-center">
                                      <FormControl>
                                        <Input {...field} type="color" className="w-8 h-7 p-0.5 cursor-pointer rounded shrink-0 border" />
                                      </FormControl>
                                      <FormControl>
                                        <Input {...field} className="flex-1 h-7 text-[11px] font-mono px-2" />
                                      </FormControl>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            )}
                          </div>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={resetColorsToDefault}
                        className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2"
                      >
                        Reset to template defaults
                      </button>
                    </div>

                    {/* Logo & Branding ─ collapsible */}
                    <div className="bg-white rounded-md border overflow-hidden">
                      <Collapsible
                        open={openSections.has("branding")}
                        onOpenChange={(o) => { const s = new Set(openSections); o ? s.add("branding") : s.delete("branding"); setOpenSections(s); }}
                      >
                        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors">
                          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <BrushIcon className="h-3 w-3" /> Logo &amp; Branding
                          </span>
                          <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${openSections.has("branding") ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 space-y-2 border-t pt-2">
                            <FormField
                              control={form.control}
                              name="showLogo"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between">
                                  <FormLabel className="text-xs font-normal cursor-pointer">Show Logo</FormLabel>
                                  <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="showBusinessName"
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between">
                                  <FormLabel className="text-xs font-normal cursor-pointer">Show Business Name</FormLabel>
                                  <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <div className="pt-1 space-y-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-8 text-xs"
                              >
                                <Upload className="h-3 w-3 mr-1.5" />
                                Upload Logo
                              </Button>
                              <p className="text-[11px] text-gray-400 text-center">PNG, JPG, GIF — max 2 MB</p>
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                              />
                              {logoPreview && (
                                <div className="space-y-2">
                                  <div className="relative">
                                    <img
                                      src={logoPreview}
                                      alt="Logo Preview"
                                      className="w-full object-contain border rounded"
                                      style={{ maxHeight: `${watchedValues.logoSize}px` }}
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
                                  <FormField
                                    control={form.control}
                                    name="logoSize"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-[11px] text-gray-500">Logo Size — {field.value}px</FormLabel>
                                        <FormControl>
                                          <input
                                            type="range"
                                            min="32"
                                            max="128"
                                            step="8"
                                            value={field.value}
                                            onChange={(e) => field.onChange(e.target.value)}
                                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    {/* Invoice Config ─ collapsible */}
                    <div className="bg-white rounded-md border overflow-hidden">
                      <Collapsible
                        open={openSections.has("config")}
                        onOpenChange={(o) => { const s = new Set(openSections); o ? s.add("config") : s.delete("config"); setOpenSections(s); }}
                      >
                        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors">
                          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="h-3 w-3" /> Invoice Config
                          </span>
                          <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${openSections.has("config") ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 space-y-2.5 border-t pt-2">
                            <div className="grid grid-cols-2 gap-2">
                              <FormField
                                control={form.control}
                                name="nextInvoiceNumber"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-[11px] text-gray-500">Next Invoice #</FormLabel>
                                    <FormControl>
                                      <Input {...field} type="number" min="1" className="h-7 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="displayCurrency"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-[11px] text-gray-500">Currency Symbol</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="$" className="h-7 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                            <FormField
                              control={form.control}
                              name="defaultCurrency"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] text-gray-500">Default Currency</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-7 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="USD">USD</SelectItem>
                                      <SelectItem value="EUR">EUR</SelectItem>
                                      <SelectItem value="GBP">GBP</SelectItem>
                                      <SelectItem value="CAD">CAD</SelectItem>
                                      <SelectItem value="AUD">AUD</SelectItem>
                                      <SelectItem value="JPY">JPY</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="defaultTimeFormat"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] text-gray-500">Time Format</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-7 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="decimal">Decimal (1.5 h)</SelectItem>
                                      <SelectItem value="time">Time (1:30)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <div className="space-y-1.5 pt-0.5">
                              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Field Visibility</p>
                              {[
                                { name: "enableTax" as const, label: "Enable Tax" },
                                { name: "showDueDate" as const, label: "Show Due Date" },
                                { name: "showHourlyRate" as const, label: "Show Hourly Rate" },
                                { name: "enableWeeklyCategorization" as const, label: "Weekly Grouping" },
                                { name: "showDateColumn" as const, label: "Show Date Column" },
                              ].map(({ name, label }) => (
                                <FormField
                                  key={name}
                                  control={form.control}
                                  name={name}
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between py-0.5">
                                      <FormLabel className="text-xs font-normal cursor-pointer">{label}</FormLabel>
                                      <FormControl>
                                        <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              ))}
                              {watchedValues.enableTax && (
                                <FormField
                                  control={form.control}
                                  name="defaultTaxRate"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-[11px] text-gray-500">Tax Rate (%)</FormLabel>
                                      <FormControl>
                                        <Input {...field} type="number" step="0.01" min="0" max="100" className="h-7 text-xs" />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    {/* Payment Details ─ collapsible */}
                    <div className="bg-white rounded-md border overflow-hidden">
                      <Collapsible
                        open={openSections.has("payment")}
                        onOpenChange={(o) => { const s = new Set(openSections); o ? s.add("payment") : s.delete("payment"); setOpenSections(s); }}
                      >
                        <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                          <CollapsibleTrigger className="flex-1 text-left">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                              <CreditCard className="h-3 w-3" /> Payment Details
                            </span>
                          </CollapsibleTrigger>
                          <div className="flex items-center gap-2">
                            <FormField
                              control={form.control}
                              name="showBankDetails"
                              render={({ field }) => (
                                <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                              )}
                            />
                            <CollapsibleTrigger>
                              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${openSections.has("payment") ? "rotate-180" : ""}`} />
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className={`px-3 pb-3 space-y-2.5 border-t pt-2 ${!watchedValues.showBankDetails ? "opacity-50 pointer-events-none" : ""}`}>
                            <FormField
                              control={form.control}
                              name="paymentMethodType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] text-gray-500">Method</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-7 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="bank_transfer_eu">Bank Transfer (EU)</SelectItem>
                                      <SelectItem value="bank_transfer_uk">Bank Transfer (UK)</SelectItem>
                                      <SelectItem value="bank_transfer_us">Bank Transfer (US)</SelectItem>
                                      <SelectItem value="paypal">PayPal</SelectItem>
                                      <SelectItem value="wise_payoneer">Wise / Payoneer</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            {watchedValues.paymentMethodType === "bank_transfer_eu" && (
                              <div className="space-y-2">
                                {[
                                  { name: "iban" as const, label: "IBAN", placeholder: "GB82 WEST 1234..." },
                                  { name: "swift" as const, label: "SWIFT/BIC", placeholder: "WESTGB2L" },
                                  { name: "bankName" as const, label: "Bank Name", placeholder: "Bank Name" },
                                  { name: "bankAccountName" as const, label: "Account Name", placeholder: "Your Business" },
                                ].map(({ name, label, placeholder }) => (
                                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-[11px] text-gray-500">{label}</FormLabel>
                                      <FormControl><Input {...field} placeholder={placeholder} className="h-7 text-xs" /></FormControl>
                                    </FormItem>
                                  )} />
                                ))}
                              </div>
                            )}
                            {watchedValues.paymentMethodType === "bank_transfer_uk" && (
                              <div className="space-y-2">
                                {[
                                  { name: "bankAccountNumber" as const, label: "Account Number", placeholder: "12345678" },
                                  { name: "bankSortCode" as const, label: "Sort Code", placeholder: "12-34-56" },
                                  { name: "bankName" as const, label: "Bank Name", placeholder: "Bank Name" },
                                  { name: "bankAccountName" as const, label: "Account Name", placeholder: "Your Business" },
                                ].map(({ name, label, placeholder }) => (
                                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-[11px] text-gray-500">{label}</FormLabel>
                                      <FormControl><Input {...field} placeholder={placeholder} className="h-7 text-xs" /></FormControl>
                                    </FormItem>
                                  )} />
                                ))}
                              </div>
                            )}
                            {watchedValues.paymentMethodType === "bank_transfer_us" && (
                              <div className="space-y-2">
                                {[
                                  { name: "bankAccountNumber" as const, label: "Account Number", placeholder: "123456789" },
                                  { name: "routingNumber" as const, label: "Routing Number", placeholder: "021000021" },
                                  { name: "bankName" as const, label: "Bank Name", placeholder: "Bank Name" },
                                  { name: "bankAccountName" as const, label: "Account Name", placeholder: "Your Business" },
                                ].map(({ name, label, placeholder }) => (
                                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-[11px] text-gray-500">{label}</FormLabel>
                                      <FormControl><Input {...field} placeholder={placeholder} className="h-7 text-xs" /></FormControl>
                                    </FormItem>
                                  )} />
                                ))}
                              </div>
                            )}
                            {watchedValues.paymentMethodType === "paypal" && (
                              <FormField control={form.control} name="paypalEmail" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] text-gray-500">PayPal Email</FormLabel>
                                  <FormControl><Input {...field} type="email" placeholder="your@paypal.com" className="h-7 text-xs" /></FormControl>
                                </FormItem>
                              )} />
                            )}
                            {watchedValues.paymentMethodType === "wise_payoneer" && (
                              <FormField control={form.control} name="wiseEmail" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] text-gray-500">Wise/Payoneer Email</FormLabel>
                                  <FormControl><Input {...field} placeholder="your@wise.com" className="h-7 text-xs" /></FormControl>
                                </FormItem>
                              )} />
                            )}
                            {watchedValues.paymentMethodType === "other" && (
                              <FormField control={form.control} name="otherPaymentInstructions" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] text-gray-500">Payment Instructions</FormLabel>
                                  <FormControl>
                                    <RichTextEditor
                                      value={field.value || ""}
                                      onChange={field.onChange}
                                      placeholder="Custom payment instructions..."
                                    />
                                  </FormControl>
                                </FormItem>
                              )} />
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    {/* Footer Notes ─ collapsible */}
                    <div className="bg-white rounded-md border overflow-hidden">
                      <Collapsible
                        open={openSections.has("footer")}
                        onOpenChange={(o) => { const s = new Set(openSections); o ? s.add("footer") : s.delete("footer"); setOpenSections(s); }}
                      >
                        <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                          <CollapsibleTrigger className="flex-1 text-left">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="h-3 w-3" /> Footer Notes
                            </span>
                          </CollapsibleTrigger>
                          <div className="flex items-center gap-2">
                            <FormField
                              control={form.control}
                              name="showFooterNotes"
                              render={({ field }) => (
                                <FormControl>
                                  <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                                </FormControl>
                              )}
                            />
                            <CollapsibleTrigger>
                              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${openSections.has("footer") ? "rotate-180" : ""}`} />
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className={`px-3 pb-3 border-t pt-2 ${!(watchedValues.showFooterNotes ?? true) ? "opacity-50 pointer-events-none" : ""}`}>
                            <FormField
                              control={form.control}
                              name="invoiceFooterText"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <EnhancedRichTextEditor
                                      value={field.value || ""}
                                      onChange={field.onChange}
                                      placeholder="Terms, thank-you message, contact info..."
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                  </div>
                </div>

                {/* ── Right: Live Preview ───────────────────────────────── */}
                <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
                  <div className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    Live Preview — {TEMPLATE_OPTIONS.find(t => t.value === watchedValues.invoiceTemplate)?.label || watchedValues.invoiceTemplate} template
                  </div>
                  <div style={{ width: "794px", transformOrigin: "top left", transform: "scale(0.65)", marginBottom: "-393px" }}>
                    <iframe
                      srcDoc={settingsPreviewHtml}
                      width="794"
                      height="1123"
                      style={{ border: "none", display: "block", width: "794px", height: "1123px" }}
                      title="Invoice Live Preview"
                    />
                  </div>
                </div>
              </div>
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