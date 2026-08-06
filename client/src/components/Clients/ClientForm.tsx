// ClientForm.tsx
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { InsertClient, Settings } from "@shared/schema";
import { CurrencySelector } from "@/components/ui/CurrencySelector";
import {
  CustomCurrencyMap,
  fetchCustomCurrencyRates,
  saveCustomCurrencyRates,
} from "@/lib/currency-rates";
import {
  generateInvoiceHTML,
  INVOICE_LABEL_FIELDS,
  INVOICE_LABELS,
  InvoiceLabels,
  InvoiceTemplateData,
  TEMPLATE_COLOR_DEFAULTS,
  TEMPLATE_OPTIONS,
} from "@/lib/invoice-html-generator";
import { formatInvoiceNumber } from "@shared/invoice-number";
import { InvoiceAiEditor } from "@/components/Invoices/InvoiceAiEditor";

const clientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  currency: z.string().default("USD"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid colour").default("#2563eb"),
  invoiceLanguage: z.string().default("en"),
  useClientInvoiceSettings: z.boolean().default(false),
  invoiceNumberPrefix: z.string().max(20).optional(),
  invoiceNumberSuffix: z.string().max(20).optional(),
  invoiceNumberPadding: z.coerce.number().int().min(0).max(12).default(4),
  invoiceTemplate: z.string().default("professional"),
  invoiceColorTheme: z.string().optional(),
  invoiceAccentColor: z.string().optional(),
  invoiceTextColor: z.string().optional(),
  invoiceBackgroundColor: z.string().optional(),
  showDateColumn: z.boolean().default(true),
  enableWeeklyCategorization: z.boolean().default(true),
  showHourlyRate: z.boolean().default(true),
  showProjectName: z.boolean().default(true),
  showInvoiceNotes: z.boolean().default(true),
  invoiceNotes: z.string().optional(),
  showPaymentTerms: z.boolean().default(false),
  paymentTerms: z.string().optional(),
  showFooterNotes: z.boolean().default(true),
  invoiceFooterText: z.string().optional(),
  showBankDetails: z.boolean().default(true),
  paymentMethodType: z.string().default("bank_transfer_us"),
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
  invoiceHeaderPlacement: z.enum(["standard", "reversed", "centered"]).default("standard"),
  invoiceInfoLayout: z.enum(["columns", "stacked"]).default("columns"),
  invoiceInfoOrder: z.string().default("payment,terms,notes"),
  invoicePaymentAccentSide: z.enum(["left", "right"]).default("left"),
});

type ClientFormValues = z.infer<typeof clientSchema>;
type ClientInvoiceProfile = Partial<ClientFormValues> & { enabled?: boolean };

const parseInvoiceProfile = (raw?: string | null): ClientInvoiceProfile => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const invoiceProfileKeys = [
  "invoiceTemplate",
  "invoiceNumberPrefix",
  "invoiceNumberSuffix",
  "invoiceNumberPadding",
  "invoiceColorTheme",
  "invoiceAccentColor",
  "invoiceTextColor",
  "invoiceBackgroundColor",
  "showDateColumn",
  "enableWeeklyCategorization",
  "showHourlyRate",
  "showProjectName",
  "showInvoiceNotes",
  "invoiceNotes",
  "showPaymentTerms",
  "paymentTerms",
  "showFooterNotes",
  "invoiceFooterText",
  "showBankDetails",
  "paymentMethodType",
  "bankName",
  "bankAccountName",
  "bankAccountNumber",
  "bankSortCode",
  "iban",
  "swift",
  "routingNumber",
  "paypalEmail",
  "wiseEmail",
  "otherPaymentInstructions",
  "invoiceHeaderPlacement",
  "invoiceInfoLayout",
  "invoiceInfoOrder",
  "invoicePaymentAccentSide",
] as const;

const buildPaymentDetails = (values: ClientFormValues) => {
  if (!values.showBankDetails) return "";
  const lines: string[] = [];

  if (values.paymentMethodType === "bank_transfer_eu") {
    if (values.bankName) lines.push(`Bank: ${values.bankName}`);
    if (values.bankAccountName) lines.push(`Account Name: ${values.bankAccountName}`);
    if (values.iban) lines.push(`IBAN: ${values.iban}`);
    if (values.swift) lines.push(`SWIFT/BIC: ${values.swift}`);
  } else if (values.paymentMethodType === "bank_transfer_uk") {
    if (values.bankName) lines.push(`Bank: ${values.bankName}`);
    if (values.bankAccountName) lines.push(`Account Name: ${values.bankAccountName}`);
    if (values.bankAccountNumber) lines.push(`Account No: ${values.bankAccountNumber}`);
    if (values.bankSortCode) lines.push(`Sort Code: ${values.bankSortCode}`);
  } else if (values.paymentMethodType === "bank_transfer_us") {
    if (values.bankName) lines.push(`Bank: ${values.bankName}`);
    if (values.bankAccountName) lines.push(`Account Name: ${values.bankAccountName}`);
    if (values.bankAccountNumber) lines.push(`Account No: ${values.bankAccountNumber}`);
    if (values.routingNumber) lines.push(`Routing No: ${values.routingNumber}`);
  } else if (values.paymentMethodType === "paypal" && values.paypalEmail) {
    lines.push(`PayPal: ${values.paypalEmail}`);
  } else if (values.paymentMethodType === "wise_payoneer" && values.wiseEmail) {
    lines.push(`Wise/Payoneer: ${values.wiseEmail}`);
  } else if (values.paymentMethodType === "other") {
    return values.otherPaymentInstructions || "";
  }

  return lines.join("<br>");
};

type ClientFormProps = {
  onSuccess: (client?: any) => void;
  onCancel?: () => void;
  initialData?: InsertClient;
  isEditing?: boolean;
  clientId?: number;
  mode?: "full" | "quick";
};

export default function ClientForm({ onSuccess, onCancel, initialData, isEditing = false, clientId, mode = "full" }: ClientFormProps) {
  console.log("★ ClientForm component rendered with props:", { onSuccess: !!onSuccess, onCancel: !!onCancel, isEditing, clientId, mode });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isQuickMode = mode === "quick";
  const invoiceProfile = parseInvoiceProfile((initialData as any)?.invoiceSettings);
  const [customInvoiceLabels, setCustomInvoiceLabels] = useState<InvoiceLabels>(INVOICE_LABELS.en);

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });
  const { data: customCurrencyData } = useQuery({
    queryKey: ["/api/custom-currency-rates"],
    queryFn: fetchCustomCurrencyRates,
  });
  const customCurrencies = customCurrencyData?.currencies || {};
  const saveCustomCurrencies = useMutation({
    mutationFn: (currencies: CustomCurrencyMap) => saveCustomCurrencyRates(currencies),
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/custom-currency-rates"], data);
      toast({ title: "Currency saved", description: "The custom currency is available in your account." });
    },
    onError: () => toast({ title: "Could not save currency", description: "Please check the code and USD rate.", variant: "destructive" }),
  });

  const { data: invoiceLabelData } = useQuery<{ labels: Partial<InvoiceLabels> }>({
    queryKey: ["/api/invoice-label-overrides"],
  });

  useEffect(() => {
    if (invoiceLabelData?.labels) {
      setCustomInvoiceLabels({ ...INVOICE_LABELS.en, ...invoiceLabelData.labels });
    }
  }, [invoiceLabelData]);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      address: initialData?.address || "",
      city: initialData?.city || "",
      state: initialData?.state || "",
      zipCode: initialData?.zipCode || "",
      country: initialData?.country || "",
      phone: initialData?.phone || "",
      taxId: initialData?.taxId || "",
      currency: initialData?.currency || "USD",
      color: (initialData as any)?.color || "#2563eb",
      invoiceLanguage: (initialData as any)?.invoiceLanguage || "en",
      useClientInvoiceSettings: invoiceProfile.enabled === true,
      invoiceNumberPrefix: invoiceProfile.invoiceNumberPrefix ?? (settings as any)?.invoiceNumberPrefix ?? "INV-",
      invoiceNumberSuffix: invoiceProfile.invoiceNumberSuffix ?? (settings as any)?.invoiceNumberSuffix ?? "",
      invoiceNumberPadding: invoiceProfile.invoiceNumberPadding ?? (settings as any)?.invoiceNumberPadding ?? 4,
      invoiceTemplate: invoiceProfile.invoiceTemplate || "professional",
      invoiceColorTheme: invoiceProfile.invoiceColorTheme || TEMPLATE_COLOR_DEFAULTS.professional.primary,
      invoiceAccentColor: invoiceProfile.invoiceAccentColor || TEMPLATE_COLOR_DEFAULTS.professional.accent || "#3b82f6",
      invoiceTextColor: invoiceProfile.invoiceTextColor || (settings as any)?.invoiceTextColor || "#374151",
      invoiceBackgroundColor: invoiceProfile.invoiceBackgroundColor || (settings as any)?.invoiceBackgroundColor || "#ffffff",
      showDateColumn: invoiceProfile.showDateColumn !== false,
      enableWeeklyCategorization: invoiceProfile.enableWeeklyCategorization !== false,
      showHourlyRate: invoiceProfile.showHourlyRate !== false,
      showProjectName: invoiceProfile.showProjectName !== false,
      showInvoiceNotes: invoiceProfile.showInvoiceNotes !== false,
      invoiceNotes: invoiceProfile.invoiceNotes || "",
      showPaymentTerms: invoiceProfile.showPaymentTerms ?? (settings as any)?.showPaymentTerms ?? false,
      paymentTerms: invoiceProfile.paymentTerms || (settings as any)?.paymentTerms || "",
      showFooterNotes: invoiceProfile.showFooterNotes !== false,
      invoiceFooterText: invoiceProfile.invoiceFooterText || "",
      showBankDetails: invoiceProfile.showBankDetails !== false,
      paymentMethodType: invoiceProfile.paymentMethodType || "bank_transfer_us",
      bankName: invoiceProfile.bankName || "",
      bankAccountName: invoiceProfile.bankAccountName || "",
      bankAccountNumber: invoiceProfile.bankAccountNumber || "",
      bankSortCode: invoiceProfile.bankSortCode || "",
      iban: invoiceProfile.iban || "",
      swift: invoiceProfile.swift || "",
      routingNumber: invoiceProfile.routingNumber || "",
      paypalEmail: invoiceProfile.paypalEmail || "",
      wiseEmail: invoiceProfile.wiseEmail || "",
      otherPaymentInstructions: invoiceProfile.otherPaymentInstructions || "",
      invoiceHeaderPlacement: invoiceProfile.invoiceHeaderPlacement || (settings as any)?.invoiceHeaderPlacement || "standard",
      invoiceInfoLayout: invoiceProfile.invoiceInfoLayout || (settings as any)?.invoiceInfoLayout || "columns",
      invoiceInfoOrder: invoiceProfile.invoiceInfoOrder || (settings as any)?.invoiceInfoOrder || "payment,terms,notes",
      invoicePaymentAccentSide: invoiceProfile.invoicePaymentAccentSide || (settings as any)?.invoicePaymentAccentSide || "left",
    },
  });

  const useClientInvoiceSettings = form.watch("useClientInvoiceSettings");
  const paymentMethodType = form.watch("paymentMethodType");
  const selectedTemplate = form.watch("invoiceTemplate");
  const previewValues = form.watch();

  const clientInvoicePreviewHtml = useMemo(() => {
    const currency = previewValues.currency || "USD";
    const subtotal = 640;
    const taxRate = settings?.enableTax ? parseFloat(settings.defaultTaxRate?.toString() || "0") : 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    const previewData: InvoiceTemplateData = {
      template: previewValues.invoiceTemplate || settings?.invoiceTemplate || "professional",
      language: previewValues.invoiceLanguage || "en",
      customLabels: previewValues.invoiceLanguage === "custom" ? customInvoiceLabels : undefined,
      businessName: settings?.businessName || "Your Business",
      businessMeta: (settings as any)?.businessTagline || "",
      businessAddress: [settings?.businessAddress, settings?.businessCity, settings?.businessState].filter(Boolean).join(", "),
      businessEmail: settings?.businessEmail || "hello@example.com",
      businessPhone: settings?.businessPhone || "",
      invoiceNumber: formatInvoiceNumber((settings as any)?.nextInvoiceNumber || 1001, {
        prefix: previewValues.invoiceNumberPrefix ?? (settings as any)?.invoiceNumberPrefix ?? "INV-",
        suffix: previewValues.invoiceNumberSuffix ?? (settings as any)?.invoiceNumberSuffix ?? "",
        padding: previewValues.invoiceNumberPadding ?? (settings as any)?.invoiceNumberPadding ?? 4,
      }),
      issueDate: "May 10, 2026",
      dueDate: settings?.showDueDate === false ? "" : "May 25, 2026",
      clientName: previewValues.name || "Client Name",
      clientAddress: previewValues.address || "Client address",
      clientCity: previewValues.city || "",
      clientState: previewValues.state || "",
      clientZip: previewValues.zipCode || "",
      clientEmail: previewValues.email || "client@example.com",
      lineItems: [
        ...(previewValues.enableWeeklyCategorization
          ? [{ description: "Week 2 of May 2026", subDescription: "", qty: "", rate: "", amount: `${currency} 640.00`, isGroupHeader: true }]
          : []),
        {
          description: "Creative direction and design work",
          subDescription: "Sample Project",
          qty: "8.00h",
          rate: `${currency} 80.00`,
          amount: `${currency} 640.00`,
          date: "May 6, 2026",
        },
      ],
      subtotalFormatted: subtotal.toFixed(2),
      taxFormatted: tax.toFixed(2),
      taxLabel: taxRate > 0 ? `Tax (${taxRate}%)` : "Tax",
      totalFormatted: total.toFixed(2),
      notes: previewValues.invoiceNotes || "",
      showNotes: previewValues.showInvoiceNotes,
      currency,
      logoUrl: (settings as any)?.companyLogo || undefined,
      showLogo: (settings as any)?.showLogo !== false,
      logoSize: (settings as any)?.logoSize || "64",
      primaryColor: previewValues.invoiceColorTheme || undefined,
      accentColor: previewValues.invoiceAccentColor || undefined,
      textColor: previewValues.invoiceTextColor || undefined,
      bgColor: previewValues.invoiceBackgroundColor || undefined,
      showDateColumn: previewValues.showDateColumn,
      showHourlyRate: previewValues.showHourlyRate,
      showProjectName: previewValues.showProjectName,
      paymentDetails: buildPaymentDetails(previewValues),
      showPaymentDetails: previewValues.showBankDetails,
      paymentTerms: previewValues.paymentTerms || "",
      showPaymentTerms: previewValues.showPaymentTerms,
      footerNotes: previewValues.invoiceFooterText || "",
      showFooterNotes: previewValues.showFooterNotes,
      invoiceHeaderPlacement: previewValues.invoiceHeaderPlacement,
      invoiceInfoLayout: previewValues.invoiceInfoLayout,
      invoiceInfoOrder: previewValues.invoiceInfoOrder,
      invoicePaymentAccentSide: previewValues.invoicePaymentAccentSide,
    };

    return generateInvoiceHTML(previewData);
  }, [previewValues, settings, customInvoiceLabels]);

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

  const createClient = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/clients", data);
    },
    onSuccess: (createdClient) => {
      console.log("★ ClientForm mutation success, created client:", createdClient);
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });

      toast({
        title: "Client created",
        description: "New client has been created successfully.",
      });

      try {
        onSuccess(createdClient);
        console.log("★ Called onSuccess from ClientForm with:", createdClient);
      } catch (error) {
        console.error("Error calling onSuccess callback:", error);
      }

      setIsSubmitting(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create client. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const updateClient = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", `/api/clients/${clientId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({
        title: "Client updated",
        description: "Client has been updated successfully.",
      });
      onSuccess();
      setIsSubmitting(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update client. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: ClientFormValues) => {
    console.log("★ ClientForm onSubmit called with data:", data);
    console.log("★ isEditing:", isEditing, "clientId:", clientId);

    const invoiceSettings = invoiceProfileKeys.reduce<Record<string, any>>(
      (profile, key) => ({ ...profile, [key]: data[key] }),
      { enabled: data.useClientInvoiceSettings }
    );

    const payload = {
      name: data.name,
      email: data.email,
      address: data.address,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      country: data.country,
      phone: data.phone,
      taxId: data.taxId,
      currency: data.currency,
      color: data.color,
      invoiceLanguage: data.invoiceLanguage,
      invoiceSettings: JSON.stringify(invoiceSettings),
    };

    setIsSubmitting(true);
    try {
      if (data.invoiceLanguage === "custom") {
        await saveInvoiceLabels.mutateAsync(customInvoiceLabels);
      }
      if (isEditing && clientId) {
        console.log("★ Using UPDATE client mutation");
        updateClient.mutate(payload);
      } else {
        console.log("★ Using CREATE client mutation");
        createClient.mutate(payload);
      }
    } catch {
      setIsSubmitting(false);
    }
  };


  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client Name *</FormLabel>
              <FormControl>
                <Input placeholder="Enter client name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="client@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input placeholder="Street address" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="City" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State/Province</FormLabel>
                <FormControl>
                  <Input placeholder="State/Province" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="zipCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ZIP/Postal Code</FormLabel>
                <FormControl>
                  <Input placeholder="ZIP/Postal Code" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <Input placeholder="Country" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="Phone number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="taxId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax ID</FormLabel>
                <FormControl>
                  <Input placeholder="Tax ID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Currency</FormLabel>
                <FormControl>
                  <CurrencySelector
                    selectedCurrency={field.value}
                    onCurrencyChange={field.onChange}
                    customCurrencies={customCurrencies}
                    onSaveCustomCurrencies={async (currencies) => { await saveCustomCurrencies.mutateAsync(currencies); }}
                    formField
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Colour</FormLabel>
                <FormControl>
                  <div className="flex h-10 items-center gap-3 rounded-md border border-input bg-background px-3">
                    <input
                      type="color"
                      value={field.value}
                      onChange={field.onChange}
                      className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label="Choose client colour"
                    />
                    <Input
                      value={field.value}
                      onChange={field.onChange}
                      className="h-8 border-0 px-0 font-mono uppercase shadow-none focus-visible:ring-0"
                      maxLength={7}
                      aria-label="Client colour hex value"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isQuickMode && (
          <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Invoice language, payment details, and template settings can be configured later from the client profile.
          </div>
        )}

        {!isQuickMode && (
          <div className="min-w-0 max-w-full rounded-lg border border-gray-200 p-4 space-y-4 bg-gray-50/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Client Invoice Profile</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Set the invoice language and optionally override the global invoice template for this client.
                </p>
              </div>
              <FormField
                control={form.control}
                name="useClientInvoiceSettings"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormLabel className="text-xs font-medium text-gray-700">Use profile</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="invoiceLanguage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Language</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="invoiceTemplate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Template</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      const colors = TEMPLATE_COLOR_DEFAULTS[value] || TEMPLATE_COLOR_DEFAULTS.professional;
                      form.setValue("invoiceColorTheme", colors.primary);
                      form.setValue("invoiceAccentColor", colors.accent || colors.primary);
                    }}
                    defaultValue={field.value}
                    disabled={!useClientInvoiceSettings}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TEMPLATE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className={!useClientInvoiceSettings ? "opacity-50 pointer-events-none space-y-4" : "space-y-4"}>
            <div className="rounded-md border bg-white p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <FormLabel>Invoice Number Format</FormLabel>
                  <p className="text-xs text-gray-500 mt-0.5">Override the global naming style for this client.</p>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {formatInvoiceNumber((settings as any)?.nextInvoiceNumber || 1001, {
                    prefix: previewValues.invoiceNumberPrefix ?? (settings as any)?.invoiceNumberPrefix ?? "INV-",
                    suffix: previewValues.invoiceNumberSuffix ?? (settings as any)?.invoiceNumberSuffix ?? "",
                    padding: previewValues.invoiceNumberPadding ?? (settings as any)?.invoiceNumberPadding ?? 4,
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="invoiceNumberPrefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prefix</FormLabel>
                      <FormControl>
                        <Input placeholder="INV-" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="invoiceNumberPadding"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Digits</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="12" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="invoiceNumberSuffix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Suffix</FormLabel>
                      <FormControl>
                        <Input placeholder="-UK" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoiceColorTheme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{TEMPLATE_COLOR_DEFAULTS[selectedTemplate]?.primaryLabel || "Primary Color"}</FormLabel>
                    <FormControl>
                      <Input type="color" className="h-10 p-1" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invoiceAccentColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{TEMPLATE_COLOR_DEFAULTS[selectedTemplate]?.accentLabel || "Accent Color"}</FormLabel>
                    <FormControl>
                      <Input type="color" className="h-10 p-1" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ["showDateColumn", "Show date column"],
                ["enableWeeklyCategorization", "Group by week"],
                ["showHourlyRate", "Show hourly rate"],
                ["showProjectName", "Show project name"],
                ["showInvoiceNotes", "Show notes"],
                ["showFooterNotes", "Show footer note"],
                ["showBankDetails", "Show payment details"],
              ].map(([name, label]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name as keyof ClientFormValues}
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border bg-white px-3 py-2 space-y-0">
                      <FormLabel className="text-sm font-medium">{label}</FormLabel>
                      <FormControl>
                        <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <FormField
              control={form.control}
              name="invoiceNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Thank you for your business..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="invoiceFooterText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Footer Note</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Payment terms, legal footnote, or thank-you message..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="rounded-md border bg-white p-3 space-y-3">
              <FormField
                control={form.control}
                name="paymentMethodType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bank_transfer_uk">UK Bank Transfer</SelectItem>
                        <SelectItem value="bank_transfer_eu">EU/International Bank Transfer</SelectItem>
                        <SelectItem value="bank_transfer_us">US Bank Transfer</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="wise_payoneer">Wise / Payoneer</SelectItem>
                        <SelectItem value="other">Other Instructions</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {["bank_transfer_uk", "bank_transfer_eu", "bank_transfer_us"].includes(paymentMethodType) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    ["bankName", "Bank Name"],
                    ["bankAccountName", "Account Name"],
                    ...(paymentMethodType !== "bank_transfer_eu" ? [["bankAccountNumber", "Account Number"]] : []),
                    ...(paymentMethodType === "bank_transfer_uk" ? [["bankSortCode", "Sort Code"]] : []),
                    ...(paymentMethodType === "bank_transfer_eu" ? [["iban", "IBAN"], ["swift", "SWIFT/BIC"]] : []),
                    ...(paymentMethodType === "bank_transfer_us" ? [["routingNumber", "Routing Number"]] : []),
                  ].map(([name, label]) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name as keyof ClientFormValues}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input {...field} value={String(field.value || "")} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              )}

              {paymentMethodType === "paypal" && (
                <FormField control={form.control} name="paypalEmail" render={({ field }) => (
                  <FormItem><FormLabel>PayPal Email</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
              )}
              {paymentMethodType === "wise_payoneer" && (
                <FormField control={form.control} name="wiseEmail" render={({ field }) => (
                  <FormItem><FormLabel>Wise / Payoneer Email</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
              )}
              {paymentMethodType === "other" && (
                <FormField control={form.control} name="otherPaymentInstructions" render={({ field }) => (
                  <FormItem><FormLabel>Payment Instructions</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                )} />
              )}
            </div>

            {previewValues.invoiceLanguage === "custom" && (
              <div className="rounded-md border bg-white p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Custom Invoice Language</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      These titles are saved to your user profile and only apply to your account.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => saveInvoiceLabels.mutate(customInvoiceLabels)}
                    disabled={saveInvoiceLabels.isPending}
                  >
                    {saveInvoiceLabels.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Save Language
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {INVOICE_LABEL_FIELDS.map((item) => (
                    <div key={item.key} className={["defaultTerms", "defaultNotes"].includes(item.key) ? "md:col-span-2" : ""}>
                      <FormLabel className="text-xs text-gray-600">{item.label}</FormLabel>
                      {["defaultTerms", "defaultNotes"].includes(item.key) ? (
                        <Textarea
                          value={customInvoiceLabels[item.key]}
                          onChange={(event) =>
                            setCustomInvoiceLabels((labels) => ({ ...labels, [item.key]: event.target.value }))
                          }
                          className="mt-1 min-h-[70px]"
                        />
                      ) : (
                        <Input
                          value={customInvoiceLabels[item.key]}
                          onChange={(event) =>
                            setCustomInvoiceLabels((labels) => ({ ...labels, [item.key]: event.target.value }))
                          }
                          className="mt-1"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <InvoiceAiEditor
            context="client"
            current={previewValues as unknown as Record<string, unknown>}
            onApply={(customization) => {
              form.setValue("useClientInvoiceSettings", true, { shouldDirty: true });
              Object.entries(customization).forEach(([key, value]) => {
                if (invoiceProfileKeys.includes(key as any)) {
                  form.setValue(key as keyof ClientFormValues, value as never, { shouldDirty: true, shouldValidate: true });
                }
              });
            }}
          />

          <div className="min-w-0 max-w-full rounded-md border bg-white p-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Live Invoice Preview</h4>
                <p className="text-xs text-gray-500">
                  This preview uses this client's currency, language, and profile settings.
                </p>
              </div>
              {!useClientInvoiceSettings && (
                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                  Inherits global template
                </span>
              )}
            </div>
            <div className="overflow-auto rounded border border-gray-200 bg-gray-100 p-3 h-[520px]">
              <div
                style={{
                  width: "794px",
                  minHeight: "1123px",
                  transformOrigin: "top left",
                  transform: "scale(0.42)",
                  marginBottom: "-650px",
                }}
              >
                <iframe
                  srcDoc={clientInvoicePreviewHtml}
                  width="794"
                  height="1123"
                  title="Client invoice profile preview"
                  style={{ border: "none", display: "block", width: "794px", height: "1123px" }}
                />
              </div>
            </div>
          </div>
        </div>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Update Client" : "Create Client"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
