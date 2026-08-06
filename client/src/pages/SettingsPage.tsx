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
  Download, Loader2, Save, Upload, X, Palette, Eye, FileText, Building,
  ChevronRight, ChevronDown, Zap, BrushIcon, Type, CreditCard,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Minus, Link, Lock
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "@shared/schema";
import {
  generateInvoiceHTML,
  INVOICE_LABEL_FIELDS,
  INVOICE_LABELS,
  InvoiceLabels,
  TEMPLATE_OPTIONS,
  TEMPLATE_COLOR_DEFAULTS,
  InvoiceLineItem,
  InvoiceTemplateData,
} from "@/lib/invoice-html-generator";
import { exportInvoicePdf } from "@/lib/invoice-pdf";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { formatInvoiceNumber } from "@shared/invoice-number";
import { calculateDueDate, formatInvoiceDate } from "@/lib/invoice-dates";
import { useAuth } from "@/hooks/useAuth";
import { getInvoiceCapabilities } from "@shared/subscriptions";
import tickdLogoFull from "@/assets/tickd-logo-full.svg";
import { InvoiceAiEditor } from "@/components/Invoices/InvoiceAiEditor";

const CURRENCY_PRESETS = [
  { code: "USD", symbol: "$",  label: "USD — US Dollar ($)" },
  { code: "EUR", symbol: "€",  label: "EUR — Euro (€)" },
  { code: "GBP", symbol: "£",  label: "GBP — British Pound (£)" },
  { code: "JPY", symbol: "¥",  label: "JPY — Japanese Yen (¥)" },
  { code: "CNY", symbol: "¥",  label: "CNY — Chinese Yuan (¥)" },
];

function resolveDisplayCurrency(currencyCode?: string | null, displayCurrency?: string | null): string {
  return CURRENCY_PRESETS.find((preset) => preset.code === currencyCode)?.symbol || displayCurrency || "$";
}

function formatPreviewQty(hours: number, timeFormat: string): string {
  if (timeFormat === "time") {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${m.toString().padStart(2, "0")}`;
  }
  return `${hours.toFixed(2)} h`;
}

function buildPaymentDetailsHtml(v: {
  paymentMethodType?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankSortCode?: string;
  iban?: string;
  swift?: string;
  routingNumber?: string;
  paypalEmail?: string;
  wiseEmail?: string;
  otherPaymentInstructions?: string;
}): string {
  const type = v.paymentMethodType;
  const lines: string[] = [];
  if (type === "bank_transfer_eu") {
    if (v.bankName) lines.push(`Bank: ${v.bankName}`);
    if (v.bankAccountName) lines.push(`Account Name: ${v.bankAccountName}`);
    if (v.iban) lines.push(`IBAN: ${v.iban}`);
    if (v.swift) lines.push(`SWIFT/BIC: ${v.swift}`);
  } else if (type === "bank_transfer_uk") {
    if (v.bankName) lines.push(`Bank: ${v.bankName}`);
    if (v.bankAccountName) lines.push(`Account Name: ${v.bankAccountName}`);
    if (v.bankAccountNumber) lines.push(`Account No: ${v.bankAccountNumber}`);
    if (v.bankSortCode) lines.push(`Sort Code: ${v.bankSortCode}`);
  } else if (type === "bank_transfer_us") {
    if (v.bankName) lines.push(`Bank: ${v.bankName}`);
    if (v.bankAccountName) lines.push(`Account Name: ${v.bankAccountName}`);
    if (v.bankAccountNumber) lines.push(`Account No: ${v.bankAccountNumber}`);
    if (v.routingNumber) lines.push(`Routing No: ${v.routingNumber}`);
  } else if (type === "paypal") {
    if (v.paypalEmail) lines.push(`PayPal: ${v.paypalEmail}`);
  } else if (type === "wise_payoneer") {
    if (v.wiseEmail) lines.push(`Wise/Payoneer: ${v.wiseEmail}`);
  } else if (type === "other") {
    return v.otherPaymentInstructions || "";
  }
  return lines.join("<br>");
}

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
  invoiceNumberPrefix: z.string().max(20, "Keep the prefix under 20 characters").optional(),
  invoiceNumberSuffix: z.string().max(20, "Keep the suffix under 20 characters").optional(),
  invoiceNumberPadding: z.coerce.number().int().min(0).max(12),
  defaultTimeFormat: z.enum(["decimal", "time"]),
  defaultCurrency: z.string().min(1, "Currency is required"),
  displayCurrency: z.string().min(1, "Display currency is required"),
  enableTax: z.boolean().default(false),
  defaultTaxRate: z.preprocess(
    (val) => (typeof val === 'number' ? val.toString() : val),
    z.string().transform((val) => (val === '' ? '0' : val))
  ),
  showDueDate: z.boolean().default(true),
  defaultDueDateMode: z.enum(["calendar_month", "days"]).default("calendar_month"),
  defaultDueDays: z.coerce.number().int().min(1).max(365).default(30),
  showPaymentTerms: z.boolean().default(false),
  paymentTerms: z.string().max(2000).optional(),
  
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
  invoiceNotes: z.string().optional(),
  invoiceFooterText: z.string().optional(),
  showCompanyDetails: z.boolean().default(true),
  showBankDetails: z.boolean().default(true),
  showInvoiceNotes: z.boolean().default(true),
  showFooterNotes: z.boolean().default(true),
  showHourlyRate: z.boolean().default(true),
  showProjectName: z.boolean().default(true),
  invoiceTemplate: z.enum(["classic", "professional", "media", "web", "graphic", "minimalistic", "freelancer", "avant", "luxe"]),
  invoiceLanguage: z.enum(["en", "sr", "de", "fr", "es", "custom"]).default("en"),
  invoiceHeaderPlacement: z.enum(["standard", "reversed", "centered"]).default("standard"),
  invoiceInfoLayout: z.enum(["columns", "stacked"]).default("columns"),
  invoiceInfoOrder: z.string().default("payment,terms,notes"),
  invoicePaymentAccentSide: z.enum(["left", "right"]).default("left"),
  
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
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const invoiceAccess = useMemo(
    () => getInvoiceCapabilities(user?.subscriptionPlan, user?.subscriptionStatus),
    [user?.subscriptionPlan, user?.subscriptionStatus],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("business");
  const [generatedPreview, setGeneratedPreview] = useState<InvoiceTemplateData | null>(null);
  const [isExportingPreview, setIsExportingPreview] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["branding"]));
  const [customInvoiceLabels, setCustomInvoiceLabels] = useState<InvoiceLabels>(INVOICE_LABELS.en);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const { data: invoiceLabelData } = useQuery<{ labels: Partial<InvoiceLabels> }>({
    queryKey: ["/api/invoice-label-overrides"],
  });

  useEffect(() => {
    if (invoiceLabelData?.labels) {
      setCustomInvoiceLabels({ ...INVOICE_LABELS.en, ...invoiceLabelData.labels });
    }
  }, [invoiceLabelData]);

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
      invoiceNumberPrefix: "INV-",
      invoiceNumberSuffix: "",
      invoiceNumberPadding: 4,
      defaultTimeFormat: "decimal",
      defaultCurrency: "USD",
      displayCurrency: "$",
      enableTax: false,
      defaultTaxRate: "0",
      showDueDate: true,
      defaultDueDateMode: "calendar_month",
      defaultDueDays: 30,
      showPaymentTerms: false,
      paymentTerms: "Payment is due according to the terms shown on this invoice.",
      companyLogo: "",
      showLogo: true,
      logoSize: "64",
      showBusinessName: true,
      invoiceColorTheme: TEMPLATE_COLOR_DEFAULTS["professional"].primary,
      invoiceAccentColor: TEMPLATE_COLOR_DEFAULTS["professional"].accent || TEMPLATE_COLOR_DEFAULTS["professional"].primary,
      invoiceTextColor: "#374151",
      invoiceBackgroundColor: "#ffffff",
      customFontSize: "12",
      invoiceNotes: "Thank you for your business. Payment due within 30 days.",
      invoiceFooterText: "",
      showCompanyDetails: true,
      showBankDetails: true,
      showInvoiceNotes: true,
      showFooterNotes: true,
      invoiceTemplate: "professional" as const,
      invoiceLanguage: "en",
      invoiceHeaderPlacement: "standard",
      invoiceInfoLayout: "columns",
      invoiceInfoOrder: "payment,terms,notes",
      invoicePaymentAccentSide: "left",
      showHourlyRate: true,
      showProjectName: true,
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
        invoiceNumberPrefix: (settings as any).invoiceNumberPrefix ?? "INV-",
        invoiceNumberSuffix: (settings as any).invoiceNumberSuffix ?? "",
        invoiceNumberPadding: (settings as any).invoiceNumberPadding ?? 4,
        defaultTimeFormat: (settings.defaultTimeFormat as "decimal" | "time") || "decimal",
        defaultCurrency: settings.defaultCurrency || "USD",
        displayCurrency: resolveDisplayCurrency(settings.defaultCurrency, settings.displayCurrency),
        enableTax: settings.enableTax ?? false,
        defaultTaxRate: settings.defaultTaxRate?.toString() || "0",
        showDueDate: settings.showDueDate ?? true,
        defaultDueDateMode: ((settings as any).defaultDueDateMode === "days" ? "days" : "calendar_month") as "days" | "calendar_month",
        defaultDueDays: Number((settings as any).defaultDueDays || 30),
        showPaymentTerms: (settings as any).showPaymentTerms ?? false,
        paymentTerms: (settings as any).paymentTerms || "Payment is due according to the terms shown on this invoice.",
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
        invoiceNotes: (settings as any).invoiceNotes || "Thank you for your business. Payment due within 30 days.",
        invoiceFooterText: settings.invoiceFooterText || "",
        showCompanyDetails: settings.showCompanyDetails ?? true,
        showBankDetails: settings.showBankDetails ?? true,
        showInvoiceNotes: (settings as any).showInvoiceNotes ?? true,
        showFooterNotes: settings.showFooterNotes ?? true,
        invoiceTemplate: (settings.invoiceTemplate as "classic" | "professional" | "media" | "web" | "graphic" | "minimalistic" | "freelancer" | "avant" | "luxe") || "professional",
        invoiceLanguage: ((settings as any).invoiceLanguage as "en" | "sr" | "de" | "fr" | "es" | "custom") || "en",
        invoiceHeaderPlacement: ((settings as any).invoiceHeaderPlacement as "standard" | "reversed" | "centered") || "standard",
        invoiceInfoLayout: ((settings as any).invoiceInfoLayout as "columns" | "stacked") || "columns",
        invoiceInfoOrder: (settings as any).invoiceInfoOrder || "payment,terms,notes",
        invoicePaymentAccentSide: ((settings as any).invoicePaymentAccentSide as "left" | "right") || "left",
        showHourlyRate: settings.showHourlyRate ?? true,
        showProjectName: (settings as any).showProjectName ?? true,
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "invoice") {
      setActiveTab("invoice");
      setOpenSections(new Set(["config", "branding", "payment"]));
    }

    if (params.get("preview") === "generated") {
      const storedPreview = sessionStorage.getItem("tickd.invoiceSettingsPreview");
      if (storedPreview) {
        try {
          setGeneratedPreview(JSON.parse(storedPreview));
        } catch {
          setGeneratedPreview(null);
        }
      }
    }
  }, [location]);

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
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please select a PNG, JPEG, or WebP image",
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

  // Build live preview data for the selected template
  const settingsPreviewData = useMemo((): InvoiceTemplateData => {
    const previewOverride = generatedPreview;
    const currency = previewOverride?.currency || resolveDisplayCurrency(watchedValues.defaultCurrency, watchedValues.displayCurrency);
    const tf = watchedValues.defaultTimeFormat || "decimal";
    const enableTax = watchedValues.enableTax ?? false;
    const taxRate = parseFloat(watchedValues.defaultTaxRate?.toString() || "0") || 0;
    const subtotal = parseFloat(previewOverride?.subtotalFormatted || "922.50") || 922.50;
    const taxAmount = enableTax ? subtotal * taxRate / 100 : 0;
    const total = subtotal + taxAmount;

    const paymentHtml = watchedValues.showBankDetails
      ? buildPaymentDetailsHtml(watchedValues)
      : "";

    const sampleLineItems: InvoiceLineItem[] = watchedValues.enableWeeklyCategorization
      ? [
          { description: "Week 1 of January 2026", subDescription: "", qty: "", rate: "", amount: `${currency}787.50`, isGroupHeader: true },
          { description: "Web Development", subDescription: "Project Alpha", qty: formatPreviewQty(8.5, tf), rate: `${currency}75.00`, amount: `${currency}637.50`, date: "Jan 15" },
          { description: "Design Review", subDescription: "UI/UX Pass", qty: formatPreviewQty(2.0, tf), rate: `${currency}75.00`, amount: `${currency}150.00`, date: "Jan 17" },
          { description: "Week 2 of January 2026", subDescription: "", qty: "", rate: "", amount: `${currency}135.00`, isGroupHeader: true },
          { description: "Consultation", subDescription: "Strategy session", qty: formatPreviewQty(1.5, tf), rate: `${currency}90.00`, amount: `${currency}135.00`, date: "Jan 20" },
        ]
      : [
          { description: "Web Development", subDescription: "Project Alpha", qty: formatPreviewQty(8.5, tf), rate: `${currency}75.00`, amount: `${currency}637.50`, date: "Jan 15" },
          { description: "Design Review", subDescription: "UI/UX Pass", qty: formatPreviewQty(2.0, tf), rate: `${currency}75.00`, amount: `${currency}150.00`, date: "Jan 17" },
          { description: "Consultation", subDescription: "Strategy session", qty: formatPreviewQty(1.5, tf), rate: `${currency}90.00`, amount: `${currency}135.00`, date: "Jan 20" },
        ];

    const data: InvoiceTemplateData = {
      ...(previewOverride || {}),
      template: watchedValues.invoiceTemplate || "professional",
      language: watchedValues.invoiceLanguage || "en",
      customLabels: watchedValues.invoiceLanguage === "custom" ? customInvoiceLabels : undefined,
      businessName: watchedValues.businessName || "Your Business",
      businessMeta: "Professional services",
      businessAddress: [watchedValues.businessAddress, watchedValues.businessCity, watchedValues.businessState].filter(Boolean).join(", "),
      businessEmail: watchedValues.businessEmail || "you@example.com",
      businessPhone: watchedValues.businessPhone || "",
      invoiceNumber: previewOverride?.invoiceNumber || formatInvoiceNumber(watchedValues.nextInvoiceNumber, {
        prefix: watchedValues.invoiceNumberPrefix,
        suffix: watchedValues.invoiceNumberSuffix,
        padding: watchedValues.invoiceNumberPadding,
      }),
      issueDate: previewOverride?.issueDate || format(new Date(), "MMMM d, yyyy"),
      dueDate: watchedValues.showDueDate
        ? previewOverride?.dueDate || formatInvoiceDate(calculateDueDate(format(new Date(), "yyyy-MM-dd"), watchedValues.defaultDueDateMode, watchedValues.defaultDueDays))
        : "",
      clientName: previewOverride?.clientName || "Sample Client Co.",
      clientAddress: previewOverride?.clientAddress || "123 Client Street",
      clientCity: previewOverride?.clientCity || "Client City",
      clientState: previewOverride?.clientState || "ST",
      clientZip: previewOverride?.clientZip || "12345",
      clientEmail: previewOverride?.clientEmail || "client@example.com",
      lineItems: previewOverride?.lineItems || sampleLineItems,
      subtotalFormatted: subtotal.toFixed(2),
      taxFormatted: taxAmount.toFixed(2),
      taxLabel: enableTax && taxRate > 0 ? `Tax (${taxRate}%)` : "Tax",
      totalFormatted: total.toFixed(2),
      notes: previewOverride?.notes || watchedValues.invoiceNotes || "Thank you for your business. Payment due within 30 days.",
      showNotes: watchedValues.showInvoiceNotes,
      currency,
      logoUrl: (watchedValues as any).companyLogo || undefined,
      showLogo: (watchedValues as any).showLogo !== false,
      logoSize: (watchedValues as any).logoSize || "64",
      primaryColor: watchedValues.invoiceColorTheme || undefined,
      accentColor: watchedValues.invoiceAccentColor || undefined,
      textColor: watchedValues.invoiceTextColor || undefined,
      bgColor: watchedValues.invoiceBackgroundColor || undefined,
      showDateColumn: watchedValues.showDateColumn,
      showHourlyRate: watchedValues.showHourlyRate,
      showProjectName: watchedValues.showProjectName,
      paymentDetails: paymentHtml,
      showPaymentDetails: watchedValues.showBankDetails && !!paymentHtml,
      paymentTerms: watchedValues.paymentTerms || "",
      showPaymentTerms: watchedValues.showPaymentTerms,
      footerNotes: watchedValues.invoiceFooterText || "",
      showFooterNotes: watchedValues.showFooterNotes ?? true,
      invoiceHeaderPlacement: watchedValues.invoiceHeaderPlacement,
      invoiceInfoLayout: watchedValues.invoiceInfoLayout,
      invoiceInfoOrder: watchedValues.invoiceInfoOrder,
      invoicePaymentAccentSide: watchedValues.invoicePaymentAccentSide,
      watermarkPreview: invoiceAccess.watermarkPreview,
      watermarkLogoUrl: invoiceAccess.watermarkPreview ? tickdLogoFull : undefined,
    };
    return data;
  }, [
    watchedValues.invoiceTemplate, watchedValues.businessName, watchedValues.businessAddress,
    watchedValues.businessCity, watchedValues.businessState, watchedValues.businessEmail,
    watchedValues.businessPhone, watchedValues.displayCurrency, watchedValues.nextInvoiceNumber,
    (watchedValues as any).companyLogo, (watchedValues as any).showLogo, (watchedValues as any).logoSize,
    watchedValues.invoiceColorTheme, watchedValues.invoiceAccentColor, watchedValues.invoiceTextColor,
    watchedValues.invoiceBackgroundColor, watchedValues.defaultTimeFormat, watchedValues.enableTax,
    watchedValues.defaultTaxRate, watchedValues.showDueDate, watchedValues.defaultDueDateMode, watchedValues.defaultDueDays,
    watchedValues.showPaymentTerms, watchedValues.paymentTerms, watchedValues.showInvoiceNotes, watchedValues.invoiceNotes, watchedValues.showDateColumn,
    watchedValues.showHourlyRate, watchedValues.showProjectName, watchedValues.enableWeeklyCategorization, watchedValues.showBankDetails, watchedValues.invoiceFooterText,
    watchedValues.showFooterNotes, watchedValues.invoiceLanguage, watchedValues.paymentMethodType, watchedValues.bankName,
    watchedValues.invoiceHeaderPlacement, watchedValues.invoiceInfoLayout, watchedValues.invoiceInfoOrder, watchedValues.invoicePaymentAccentSide,
    watchedValues.bankAccountName, watchedValues.bankAccountNumber, watchedValues.bankSortCode,
    watchedValues.iban, watchedValues.swift, watchedValues.routingNumber, watchedValues.paypalEmail,
    watchedValues.wiseEmail, watchedValues.otherPaymentInstructions, generatedPreview, customInvoiceLabels,
    invoiceAccess.watermarkPreview,
  ]);

  const settingsPreviewHtml = useMemo(() => generateInvoiceHTML(settingsPreviewData), [settingsPreviewData]);

  const handleExportPreviewPdf = async () => {
    if (!invoiceAccess.canExport) {
      toast({
        title: "Pro feature",
        description: "Upgrade to Pro to export clean, selectable-text invoice PDFs.",
      });
      navigate("/plans");
      return;
    }
    setIsExportingPreview(true);
    try {
      const invoiceNumber = settingsPreviewData.invoiceNumber.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "") || "invoice";
      await exportInvoicePdf(settingsPreviewData, `${invoiceNumber}-preview.pdf`);
      toast({
        title: "Invoice exported",
        description: "The current invoice preview has been exported as a PDF.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export this invoice preview.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPreview(false);
    }
  };

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      console.log("[Settings Frontend] Sending data to API:", data);
      const response = await apiRequest("PUT", "/api/settings", data);
      console.log("[Settings Frontend] API response received:", response);
      return response.json() as Promise<Settings>;
    },
    onSuccess: (updatedSettings) => {
      console.log("[Settings Frontend] Update successful");
      queryClient.setQueryData(["/api/settings"], updatedSettings);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully.",
      });
    },
    onError: (error) => {
      console.error("[Settings Frontend] Error updating settings:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveInvoiceLabels = useMutation({
    mutationFn: async (labels: InvoiceLabels) => {
      return apiRequest("PUT", "/api/invoice-label-overrides", { labels });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoice-label-overrides"] });
      toast({
        title: "Custom language saved",
        description: "Your invoice wording has been saved to your user profile.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save custom invoice language. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: SettingsFormData) => {
    console.log("[Settings Frontend] Form submitted with data:", data);
    console.log("[Settings Frontend] Form errors:", form.formState.errors);
    setIsSubmitting(true);
    try {
      if (data.invoiceLanguage === "custom") {
        await saveInvoiceLabels.mutateAsync(customInvoiceLabels);
      }
      await updateSettingsMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
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
                      <FormField
                        control={form.control}
                        name="invoiceLanguage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[11px] text-gray-500">Invoice Language</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="sr">Serbian</SelectItem>
                                <SelectItem value="de">German</SelectItem>
                                <SelectItem value="fr">French</SelectItem>
                                <SelectItem value="es">Spanish</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
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
                      {watchedValues.invoiceLanguage === "custom" && (
                        <div className="pt-2 border-t space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[11px] font-semibold text-gray-500">Custom language</p>
                              <p className="text-[11px] text-gray-400">Saved only to your user profile.</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => saveInvoiceLabels.mutate(customInvoiceLabels)}
                              disabled={saveInvoiceLabels.isPending}
                            >
                              {saveInvoiceLabels.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                              Save
                            </Button>
                          </div>
                          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {INVOICE_LABEL_FIELDS.map((item) => (
                              <div key={item.key}>
                                <Label className="text-[11px] text-gray-500">{item.label}</Label>
                                {["defaultTerms", "defaultNotes"].includes(item.key) ? (
                                  <Textarea
                                    value={customInvoiceLabels[item.key]}
                                    onChange={(event) => setCustomInvoiceLabels((labels) => ({ ...labels, [item.key]: event.target.value }))}
                                    className="mt-1 min-h-[64px] text-xs"
                                  />
                                ) : (
                                  <Input
                                    value={customInvoiceLabels[item.key]}
                                    onChange={(event) => setCustomInvoiceLabels((labels) => ({ ...labels, [item.key]: event.target.value }))}
                                    className="mt-1 h-7 text-xs"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
                              <p className="text-[11px] text-gray-400 text-center">PNG, JPG, or WebP - max 2 MB</p>
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
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
                            <FormField
                              control={form.control}
                              name="nextInvoiceNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] text-gray-500">Next Number</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="number" min="1" className="h-7 text-xs" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <FormField
                                control={form.control}
                                name="invoiceNumberPrefix"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-[11px] text-gray-500">Prefix</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="INV-" className="h-7 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="invoiceNumberPadding"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-[11px] text-gray-500">Digits</FormLabel>
                                    <FormControl>
                                      <Input {...field} type="number" min="0" max="12" className="h-7 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="invoiceNumberSuffix"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-[11px] text-gray-500">Suffix</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="-UK" className="h-7 text-xs" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                            <div className="rounded-md border bg-gray-50 px-2.5 py-2 text-xs text-gray-600">
                              Preview: <span className="font-semibold text-gray-900">
                                {formatInvoiceNumber(watchedValues.nextInvoiceNumber, {
                                  prefix: watchedValues.invoiceNumberPrefix,
                                  suffix: watchedValues.invoiceNumberSuffix,
                                  padding: watchedValues.invoiceNumberPadding,
                                })}
                              </span>
                            </div>
                            {/* Currency — unified preset + custom picker */}
                            <FormItem>
                              <FormLabel className="text-[11px] text-gray-500">Currency</FormLabel>
                              <Select
                                value={CURRENCY_PRESETS.find(p => p.code === watchedValues.defaultCurrency) ? watchedValues.defaultCurrency : "custom"}
                                onValueChange={(value) => {
                                  const preset = CURRENCY_PRESETS.find(p => p.code === value);
                                  if (preset) {
                                    form.setValue("defaultCurrency", preset.code, { shouldDirty: true });
                                    form.setValue("displayCurrency", preset.symbol, { shouldDirty: true });
                                  } else {
                                    form.setValue("defaultCurrency", "CUSTOM", { shouldDirty: true });
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CURRENCY_PRESETS.map(p => (
                                    <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>
                                  ))}
                                  <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                              </Select>
                              {!CURRENCY_PRESETS.find(p => p.code === watchedValues.defaultCurrency) && (
                                <FormField
                                  control={form.control}
                                  name="displayCurrency"
                                  render={({ field }) => (
                                    <FormControl>
                                      <Input {...field} placeholder="e.g. kr, R, ₹" className="h-7 text-xs mt-1.5" />
                                    </FormControl>
                                  )}
                                />
                              )}
                            </FormItem>
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
                              {/* Enable Tax — standalone so rate field appears right below it */}
                              <FormField
                                control={form.control}
                                name="enableTax"
                                render={({ field }) => (
                                  <FormItem className="flex items-center justify-between py-0.5">
                                    <FormLabel className="text-xs font-normal cursor-pointer">Enable Tax</FormLabel>
                                    <FormControl>
                                      <Switch checked={!!field.value} onCheckedChange={field.onChange} />
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
                                      <FormLabel className="text-[11px] text-gray-500">Tax Rate (%)</FormLabel>
                                      <FormControl>
                                        <Input {...field} type="number" step="0.01" min="0" max="100" className="h-7 text-xs" />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              )}
                              {[
                                { name: "showDueDate" as const, label: "Show Due Date" },
                                { name: "showHourlyRate" as const, label: "Show Hourly Rate" },
                                { name: "showProjectName" as const, label: "Show Project Name" },
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
                              {watchedValues.showDueDate && (
                                <div className="mt-2 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-2">
                                  <FormField
                                    control={form.control}
                                    name="defaultDueDateMode"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-[11px] text-gray-500">Default Payment Period</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                          <FormControl><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                          <SelectContent>
                                            <SelectItem value="calendar_month">1 calendar month</SelectItem>
                                            <SelectItem value="days">Custom number of days</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </FormItem>
                                    )}
                                  />
                                  {watchedValues.defaultDueDateMode === "days" && (
                                    <FormField
                                      control={form.control}
                                      name="defaultDueDays"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-[11px] text-gray-500">Days</FormLabel>
                                          <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                                            <FormControl><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                              {[7, 14, 30, 45, 60, 90].map((days) => <SelectItem key={days} value={String(days)}>{days} days</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </FormItem>
                                      )}
                                    />
                                  )}
                                </div>
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

                    {/* Payment Terms - kept separately from payment account details */}
                    <div className="bg-white rounded-md border overflow-hidden">
                      <Collapsible
                        open={openSections.has("terms")}
                        onOpenChange={(o) => { const s = new Set(openSections); o ? s.add("terms") : s.delete("terms"); setOpenSections(s); }}
                      >
                        <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                          <CollapsibleTrigger className="flex-1 text-left">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="h-3 w-3" /> Payment Terms
                            </span>
                          </CollapsibleTrigger>
                          <div className="flex items-center gap-2">
                            <FormField
                              control={form.control}
                              name="showPaymentTerms"
                              render={({ field }) => <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>}
                            />
                            <CollapsibleTrigger>
                              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${openSections.has("terms") ? "rotate-180" : ""}`} />
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className={`px-3 pb-3 border-t pt-2 ${!watchedValues.showPaymentTerms ? "opacity-50 pointer-events-none" : ""}`}>
                            <FormField
                              control={form.control}
                              name="paymentTerms"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Textarea
                                      value={field.value || ""}
                                      onChange={field.onChange}
                                      className="min-h-20 text-xs"
                                      placeholder="Payment is due by the stated due date."
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    {/* Invoice Notes ─ collapsible */}
                    <div className="bg-white rounded-md border overflow-hidden">
                      <Collapsible
                        open={openSections.has("notes")}
                        onOpenChange={(o) => { const s = new Set(openSections); o ? s.add("notes") : s.delete("notes"); setOpenSections(s); }}
                      >
                        <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                          <CollapsibleTrigger className="flex-1 text-left">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="h-3 w-3" /> Invoice Notes
                            </span>
                          </CollapsibleTrigger>
                          <div className="flex items-center gap-2">
                            <FormField
                              control={form.control}
                              name="showInvoiceNotes"
                              render={({ field }) => (
                                <FormControl>
                                  <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                                </FormControl>
                              )}
                            />
                            <CollapsibleTrigger>
                              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${openSections.has("notes") ? "rotate-180" : ""}`} />
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className={`px-3 pb-3 border-t pt-2 ${!(watchedValues.showInvoiceNotes ?? true) ? "opacity-50 pointer-events-none" : ""}`}>
                            <FormField
                              control={form.control}
                              name="invoiceNotes"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Textarea
                                      value={field.value || ""}
                                      onChange={field.onChange}
                                      className="min-h-20 text-xs"
                                      placeholder="Thank-you message, invoice terms, or client-facing note..."
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
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
                  <InvoiceAiEditor
                    context="settings"
                    current={watchedValues as unknown as Record<string, unknown>}
                    onApply={(customization) => {
                      Object.entries(customization).forEach(([key, value]) => {
                        form.setValue(key as keyof SettingsFormData, value as never, { shouldDirty: true, shouldValidate: true });
                      });
                    }}
                    className="mb-4 bg-white"
                  />
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" />
                      Live Preview — {TEMPLATE_OPTIONS.find(t => t.value === watchedValues.invoiceTemplate)?.label || watchedValues.invoiceTemplate} template
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleExportPreviewPdf}
                      disabled={isExportingPreview || !invoiceAccess.canExport}
                      className="h-8 text-xs bg-white"
                      title={invoiceAccess.canExport ? "Export invoice preview as PDF" : "Upgrade to Pro to export invoices"}
                    >
                      {isExportingPreview ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : !invoiceAccess.canExport ? (
                        <Lock className="h-3.5 w-3.5 mr-1.5" />
                      ) : (
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {invoiceAccess.canExport ? "Export PDF" : "Pro export"}
                    </Button>
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
