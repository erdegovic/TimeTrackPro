import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit, FileSpreadsheet, File, Plus, Minus, Loader2, Lock, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatTimeFromDecimal, formatCurrency, parseTime } from "@/lib/utils/timeUtils";
import { Client, Settings, TimeFormat } from "@shared/schema";
import { generateInvoiceHTML, InvoiceLabels, InvoiceLineItem, InvoiceTemplateData } from "@/lib/invoice-html-generator";
import { exportInvoicePdf } from "@/lib/invoice-pdf";
import { useLocation } from "wouter";
import { InvoiceDateFields } from "./InvoiceDateFields";
import { calculateDueDate, DueDateMode, formatInvoiceDate, toInvoiceDateInput } from "@/lib/invoice-dates";
import { useAuth } from "@/hooks/useAuth";
import { getInvoiceCapabilities } from "@shared/subscriptions";
import tickdLogoFull from "@/assets/tickd-logo-full.svg";

interface InvoicePreviewProps {
  reportData: any;
  clientId?: number;
  client?: Client;
  settings?: Settings;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  setDueDate?: (date: string) => void;
  additionalItems?: any[];
  setAdditionalItems?: (items: any[]) => void;
  notes?: string;
  setNotes?: (notes: string) => void;
  showDueDate?: boolean;
  setShowDueDate?: (show: boolean) => void;
  onEditInvoice?: () => void;
  isEditing?: boolean;
  invoice?: any;
}

const parseClientInvoiceSettings = (client?: Client) => {
  const raw = (client as any)?.invoiceSettings;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const paymentLabelSets: Record<string, Record<string, string>> = {
  en: { bank: "Bank", accountName: "Account Name", accountNo: "Account No", sortCode: "Sort Code", routingNo: "Routing No", swift: "SWIFT/BIC" },
  sr: { bank: "Banka", accountName: "Naziv racuna", accountNo: "Broj racuna", sortCode: "Sort code", routingNo: "Routing broj", swift: "SWIFT/BIC" },
  de: { bank: "Bank", accountName: "Kontoinhaber", accountNo: "Kontonummer", sortCode: "Bankleitzahl", routingNo: "Routingnummer", swift: "SWIFT/BIC" },
  fr: { bank: "Banque", accountName: "Titulaire du compte", accountNo: "Numero de compte", sortCode: "Sort code", routingNo: "Numero de routage", swift: "SWIFT/BIC" },
  es: { bank: "Banco", accountName: "Titular de la cuenta", accountNo: "Numero de cuenta", sortCode: "Sort code", routingNo: "Numero de ruta", swift: "SWIFT/BIC" },
};

type GroupedInvoiceEntry = {
  id: string;
  sourceEntryIds: number[];
  description: string;
  project?: any;
  projectId?: number | null;
  hourlyRate: string;
  duration: number;
  amount: number;
  weekLabel?: string;
  weekNumber?: number;
};

const getInvoiceReportRows = (reportData: any) => {
  if (reportData?.weeklyData?.length) {
    return reportData.weeklyData.flatMap((week: any) =>
      (week.entries || []).map((entry: any) => ({
        ...entry,
        weekLabel: week.weekLabel || `Week ${week.weekNumber}`,
        weekNumber: week.weekNumber,
      }))
    );
  }

  return reportData?.timeEntries || [];
};

const reportHasWeeklyGroups = (reportData: any) => {
  if (!reportData?.weeklyData?.length) return false;
  return !(reportData.weeklyData.length === 1 && reportData.weeklyData[0]?.weekLabel === "Selected Period");
};

export default function InvoicePreview({
  reportData,
  clientId,
  client: propClient,
  settings: propSettings,
  invoiceNumber: propInvoiceNumber,
  issueDate: propIssueDate,
  dueDate: propDueDate,
  setDueDate,
  additionalItems: propAdditionalItems,
  setAdditionalItems: propSetAdditionalItems,
  notes: propNotes,
  setNotes: propSetNotes,
  showDueDate: propShowDueDate,
  setShowDueDate: propSetShowDueDate,
  onEditInvoice,
  isEditing = false,
  invoice,
}: InvoicePreviewProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const invoiceAccess = useMemo(
    () => getInvoiceCapabilities(user?.subscriptionPlan, user?.subscriptionStatus),
    [user?.subscriptionPlan, user?.subscriptionStatus],
  );
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [editableEntries, setEditableEntries] = useState<any[]>([]);
  const [additionalItems, setAdditionalItems] = useState<{ description: string; amount: number; id: number }[]>(
    propAdditionalItems || []
  );
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [notes, setNotes] = useState(propNotes || "");
  const [showInvoiceNotes, setShowInvoiceNotes] = useState(true);
  const [showDueDate, setShowDueDate] = useState(propShowDueDate !== undefined ? propShowDueDate : true);
  const [taxRate, setTaxRate] = useState(0);
  const [enableTax, setEnableTax] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [issueDateValue, setIssueDateValue] = useState(() => toInvoiceDateInput(propIssueDate));
  const [dueDateMode, setDueDateMode] = useState<DueDateMode>(propDueDate ? "manual" : "calendar_month");
  const [dueDateDays, setDueDateDays] = useState(30);
  const [dueDateValue, setDueDateValue] = useState(() =>
    propDueDate ? toInvoiceDateInput(propDueDate) : calculateDueDate(toInvoiceDateInput(propIssueDate), "calendar_month")
  );
  const dateDefaultsApplied = useRef(false);

  const { data: invoiceNumberData } = useQuery({
    queryKey: ["/api/next-invoice-number", clientId || "global"],
    queryFn: async () => {
      const params = clientId ? `?clientId=${clientId}` : "";
      const res = await fetch(`/api/next-invoice-number${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: invoiceAccess.canSave && !propInvoiceNumber,
  });

  useEffect(() => {
    if (propInvoiceNumber) {
      setInvoiceNumber(propInvoiceNumber);
    } else if (invoiceAccess.watermarkPreview) {
      setInvoiceNumber("PREVIEW");
    } else if (invoiceNumberData?.invoiceNumber) {
      setInvoiceNumber(invoiceNumberData.invoiceNumber);
    }
  }, [invoiceAccess.watermarkPreview, invoiceNumberData, propInvoiceNumber]);

  const { data: client } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!clientId,
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const { data: invoiceLabelData } = useQuery<{ labels: Partial<InvoiceLabels> }>({
    queryKey: ["/api/invoice-label-overrides"],
  });

  const activeClient = propClient || client;
  const activeSettings = propSettings || settings;
  const clientInvoiceSettings = useMemo(() => parseClientInvoiceSettings(activeClient), [activeClient]);
  const effectiveSettings = useMemo(() => {
    if (clientInvoiceSettings?.enabled) {
      return { ...(activeSettings || {}), ...clientInvoiceSettings } as Settings & Record<string, any>;
    }
    return activeSettings;
  }, [activeSettings, clientInvoiceSettings]);

  useEffect(() => {
    if (effectiveSettings) {
      const taxEnabled = typeof effectiveSettings.enableTax === "boolean" ? effectiveSettings.enableTax : false;
      const rate =
        typeof effectiveSettings.defaultTaxRate === "number"
          ? effectiveSettings.defaultTaxRate
          : parseFloat(effectiveSettings.defaultTaxRate?.toString() || "0");
      setEnableTax(taxEnabled);
      setTaxRate(rate);
      if (typeof effectiveSettings.showDueDate === "boolean") setShowDueDate(effectiveSettings.showDueDate);
      setShowInvoiceNotes((effectiveSettings as any).showInvoiceNotes !== false);
      if (!propNotes && !notes && (effectiveSettings as any).invoiceNotes) {
        setNotes((effectiveSettings as any).invoiceNotes);
      }
      if (!propDueDate && !dateDefaultsApplied.current) {
        const mode = ((effectiveSettings as any).defaultDueDateMode || "calendar_month") as DueDateMode;
        const days = Number((effectiveSettings as any).defaultDueDays || 30);
        setDueDateMode(mode === "manual" ? "calendar_month" : mode);
        setDueDateDays(days);
        setDueDateValue(calculateDueDate(issueDateValue, mode === "days" ? "days" : "calendar_month", days));
        dateDefaultsApplied.current = true;
      }
    }
  }, [effectiveSettings, propNotes, propDueDate, issueDateValue]);

  const issueDate = formatInvoiceDate(issueDateValue);
  const dueDate = formatInvoiceDate(dueDateValue);

  const formatHoursForInvoice = (hours: number, timeFormat: TimeFormat): string => {
    return timeFormat === "decimal" ? `${hours.toFixed(2)}h` : formatTimeFromDecimal(hours);
  };

  const formatHoursForInput = (hours: number, timeFormat: TimeFormat): string => {
    return timeFormat === "decimal" ? hours.toFixed(2) : formatTimeFromDecimal(hours);
  };

  const reportUsesWeeklyGrouping = useMemo(() => reportHasWeeklyGroups(reportData), [reportData]);

  useEffect(() => {
    if (reportData) {
      const invoiceRows = getInvoiceReportRows(reportData);
      const data = invoiceRows.map((e: any) => ({
        ...e,
        originalDuration: e.adjustedDuration ?? e.originalDuration ?? e.duration,
        editedDuration: e.adjustedDuration ?? e.originalDuration ?? e.duration,
        originalAmount: parseFloat(e.amount),
      }));
      const rowsTotal = data.reduce((sum: number, entry: any) => {
        const amount = parseFloat(entry.amount?.toString() || "0");
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);

      setEditableEntries(data);
      setSubtotal(rowsTotal);
      const tax = enableTax ? rowsTotal * (taxRate / 100) : 0;
      setTotal(rowsTotal + tax);
    }
  }, [reportData, enableTax, taxRate]);

  const getAdditionalItemsTotal = useCallback(
    () => additionalItems.reduce((s, i) => s + i.amount, 0),
    [additionalItems]
  );

  const recalculateTotals = useCallback(
    (entries = editableEntries) => {
      const entriesTotal = entries.reduce((s, e) => s + parseFloat(e.amount), 0);
      setSubtotal(entriesTotal);
      const additionalTotal = additionalItems.reduce((s, i) => s + i.amount, 0);
      const tax = enableTax ? entriesTotal * (taxRate / 100) : 0;
      setTotal(entriesTotal + additionalTotal + tax);
    },
    [additionalItems, enableTax, taxRate]
  );

  const updateEntryDuration = (entryId: number, newDuration: number, timeFormat: TimeFormat) => {
    setEditableEntries((prev) => {
      const updated = prev.map((e) => {
        if (e.id === entryId) {
          const rate = parseFloat(e.hourlyRate || e.project?.hourlyRate || "0");
          return { ...e, editedDuration: newDuration, duration: newDuration, editedAmount: rate * newDuration, amount: (rate * newDuration).toString(), wasEdited: true };
        }
        return e;
      });
      recalculateTotals(updated);
      return updated;
    });
  };

  const getWeekLabelByEntryId = useCallback(() => {
    const weekLabelByEntryId = new Map<number, string>();
    reportData?.weeklyData?.forEach((week: any) => {
      week.entries?.forEach((entry: any) => {
        weekLabelByEntryId.set(entry.id, week.weekLabel || `Week ${week.weekNumber}`);
      });
    });
    return weekLabelByEntryId;
  }, [reportData]);

  const getEntryDuration = (entry: any) => {
    if (typeof entry.editedDuration === "number") return entry.editedDuration;
    if (typeof entry.adjustedDuration === "number") return entry.adjustedDuration;
    if (typeof entry.originalDuration === "number") return entry.originalDuration;
    return parseFloat(entry.duration?.toString() || "0") || 0;
  };

  const getEntryAmount = (entry: any) => {
    if (typeof entry.editedAmount === "number") return entry.editedAmount;
    const parsedAmount = parseFloat(entry.amount?.toString() || "0");
    if (Number.isFinite(parsedAmount)) return parsedAmount;
    return getEntryDuration(entry) * getEntryRate(entry);
  };

  const getEntryRate = (entry: any) => {
    return parseFloat(entry.hourlyRate || entry.project?.hourlyRate || "0") || 0;
  };

  const groupedInvoiceEntries = useMemo(() => {
    if (!reportData) return [];

    return editableEntries.map((entry: any): GroupedInvoiceEntry => {
      const rate = getEntryRate(entry);
      return {
        id: `${entry.weekLabel || "all"}|${entry.id}`,
        sourceEntryIds: Array.isArray(entry.sourceEntryIds) ? entry.sourceEntryIds : [entry.id].filter(Boolean),
        description: entry.description || "Service",
        project: entry.project,
        projectId: entry.projectId || entry.project?.id || null,
        hourlyRate: rate.toString(),
        duration: getEntryDuration(entry),
        amount: getEntryAmount(entry),
        weekLabel: reportUsesWeeklyGrouping ? entry.weekLabel : undefined,
        weekNumber: entry.weekNumber,
      };
    });
  }, [editableEntries, reportData, reportUsesWeeklyGrouping]);

  const addItem = () => {
    const newItems = [...additionalItems, { id: Date.now(), description: "Additional Item", amount: 0 }];
    setAdditionalItems(newItems);
    setTimeout(() => recalculateTotals(editableEntries), 0);
  };

  const updateAdditionalItem = (id: number, field: "description" | "amount", value: string) => {
    const updated = additionalItems.map((item) =>
      item.id === id ? { ...item, [field]: field === "amount" ? parseFloat(value) || 0 : value } : item
    );
    setAdditionalItems(updated);
    const additionalTotal = updated.reduce((s, i) => s + i.amount, 0);
    const entriesTotal = editableEntries.reduce((s, e) => s + parseFloat(e.amount), 0);
    const tax = enableTax ? entriesTotal * (taxRate / 100) : 0;
    setSubtotal(entriesTotal);
    setTotal(entriesTotal + additionalTotal + tax);
  };

  const removeItem = (id: number) => {
    const filtered = additionalItems.filter((i) => i.id !== id);
    setAdditionalItems(filtered);
    const additionalTotal = filtered.reduce((s, i) => s + i.amount, 0);
    const entriesTotal = editableEntries.reduce((s, e) => s + parseFloat(e.amount), 0);
    const tax = enableTax ? entriesTotal * (taxRate / 100) : 0;
    setSubtotal(entriesTotal);
    setTotal(entriesTotal + additionalTotal + tax);
  };

  const handleCreateInvoice = async () => {
    if (!invoiceAccess.canSave) {
      toast({ title: "Pro feature", description: "Upgrade to Pro to save invoice records." });
      return;
    }
    if (!reportData || !activeClient) {
      toast({ title: "Error", description: "Missing client or report data", variant: "destructive" });
      return;
    }
    try {
      const timeEntryIds = reportData.timeEntries.map((e: any) => e.id);
      const entriesSubtotal = groupedInvoiceEntries.length > 0
        ? groupedInvoiceEntries.reduce((s, e) => s + e.amount, 0)
        : editableEntries.reduce((s, e) => s + parseFloat(e.amount.toString()), 0);
      const additionalItemsTotal = additionalItems.reduce((s, i) => s + (i.amount || 0), 0);
      const invoiceSubtotal = entriesSubtotal;
      const tax = enableTax ? invoiceSubtotal * (taxRate / 100) : 0;
      const invoiceTotal = invoiceSubtotal + additionalItemsTotal + tax;

      const weekLabelByEntryId = getWeekLabelByEntryId();
      const lineItemsData = [
        ...groupedInvoiceEntries.map((e) => ({
          timeEntryId: e.sourceEntryIds[0],
          timeEntryIds: e.sourceEntryIds,
          isTimeEntry: true,
          description: e.description,
          projectName: e.project?.name || "",
          weekLabel: e.weekLabel || weekLabelByEntryId.get(e.sourceEntryIds[0]) || "",
          hours: e.duration,
          rate: parseFloat(e.hourlyRate || "0"),
          amount: e.amount,
        })),
        ...additionalItems.map((item) => ({ id: item.id, isTimeEntry: false, description: item.description, amount: item.amount })),
      ];

      await apiRequest("POST", "/api/invoices", {
        clientId: activeClient.id,
        subtotal: invoiceSubtotal.toFixed(2),
        tax: tax.toFixed(2),
        taxRate: (enableTax ? taxRate : 0).toFixed(2),
        total: invoiceTotal.toFixed(2),
        notes,
        timeEntryIds,
        issueDate: issueDateValue,
        dueDate: dueDateValue,
        invoiceNumber,
        status: "draft",
        lineItems: JSON.stringify(lineItemsData),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({ title: "Invoice created", description: "Your invoice has been saved successfully." });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create invoice.", variant: "destructive" });
    }
  };

  const templateData = useMemo((): InvoiceTemplateData => {
    const currency = activeClient?.currency || "USD";
    const timeFormat = (reportData?.timeFormat as TimeFormat) || "decimal";
    const useWeeklyGrouping = reportUsesWeeklyGrouping;

    const buildEntryLineItem = (e: any): InvoiceLineItem => {
        const duration = getEntryDuration(e);
        const amount = getEntryAmount(e);
        const rate = getEntryRate(e);
        return {
          description: e.description || "Service",
          subDescription: e.project?.name || "",
          qty: formatHoursForInvoice(duration, timeFormat),
          rate: formatCurrency(rate, currency),
          amount: formatCurrency(amount, currency),
        };
    };

    const timeLineItems: InvoiceLineItem[] = [];

    if (useWeeklyGrouping) {
      reportData.weeklyData.forEach((week: any) => {
        const weekLabel = week.weekLabel || `Week ${week.weekNumber}`;
        const weekEntries = groupedInvoiceEntries.filter((entry) => entry.weekLabel === weekLabel);
        if (weekEntries.length === 0) return;

        const weekTotal = weekEntries.reduce((sum, entry) => sum + entry.amount, 0);

        timeLineItems.push({
          description: weekLabel,
          subDescription: "",
          qty: "",
          rate: "",
          amount: formatCurrency(weekTotal, currency),
          isGroupHeader: true,
        });

        weekEntries.forEach((entry: any) => {
          timeLineItems.push(buildEntryLineItem(entry));
        });
      });

      if (timeLineItems.length === 0) {
        groupedInvoiceEntries.forEach((entry) => {
          timeLineItems.push(buildEntryLineItem(entry));
        });
      }
    } else {
      groupedInvoiceEntries.forEach((entry) => {
        timeLineItems.push(buildEntryLineItem(entry));
      });
    }

    if (timeLineItems.length === 0) {
      editableEntries.forEach((entry) => {
        timeLineItems.push(buildEntryLineItem(entry));
      });
    }

    const lineItems = [
      ...timeLineItems,
      ...additionalItems.map((item) => ({
        description: item.description || "Additional Item",
        subDescription: "",
        qty: "1",
        rate: formatCurrency(item.amount, currency),
        amount: formatCurrency(item.amount, currency),
      })),
    ];

    const taxAmount = enableTax ? subtotal * (taxRate / 100) : 0;
    const totalAmount = subtotal + getAdditionalItemsTotal() + taxAmount;

    const s = effectiveSettings;
    const c = activeClient;
    const language = (c as any)?.invoiceLanguage || (s as any)?.invoiceLanguage || "en";
    const paymentLabels = paymentLabelSets[language] || paymentLabelSets.en;

    const paymentDetails = (() => {
      if (!(s as any)?.showBankDetails) return "";
      const type = (s as any)?.paymentMethodType;
      const lines: string[] = [];
      if (type === "bank_transfer_eu") {
        if ((s as any)?.bankName) lines.push(`${paymentLabels.bank}: ${(s as any).bankName}`);
        if ((s as any)?.bankAccountName) lines.push(`${paymentLabels.accountName}: ${(s as any).bankAccountName}`);
        if ((s as any)?.iban) lines.push(`IBAN: ${(s as any).iban}`);
        if ((s as any)?.swift) lines.push(`${paymentLabels.swift}: ${(s as any).swift}`);
      } else if (type === "bank_transfer_uk") {
        if ((s as any)?.bankName) lines.push(`${paymentLabels.bank}: ${(s as any).bankName}`);
        if ((s as any)?.bankAccountName) lines.push(`${paymentLabels.accountName}: ${(s as any).bankAccountName}`);
        if ((s as any)?.bankAccountNumber) lines.push(`${paymentLabels.accountNo}: ${(s as any).bankAccountNumber}`);
        if ((s as any)?.bankSortCode) lines.push(`${paymentLabels.sortCode}: ${(s as any).bankSortCode}`);
      } else if (type === "bank_transfer_us") {
        if ((s as any)?.bankName) lines.push(`${paymentLabels.bank}: ${(s as any).bankName}`);
        if ((s as any)?.bankAccountName) lines.push(`${paymentLabels.accountName}: ${(s as any).bankAccountName}`);
        if ((s as any)?.bankAccountNumber) lines.push(`${paymentLabels.accountNo}: ${(s as any).bankAccountNumber}`);
        if ((s as any)?.routingNumber) lines.push(`${paymentLabels.routingNo}: ${(s as any).routingNumber}`);
      } else if (type === "paypal") {
        if ((s as any)?.paypalEmail) lines.push(`PayPal: ${(s as any).paypalEmail}`);
      } else if (type === "wise_payoneer") {
        if ((s as any)?.wiseEmail) lines.push(`Wise/Payoneer: ${(s as any).wiseEmail}`);
      } else if (type === "other") {
        return (s as any)?.otherPaymentInstructions || "";
      }
      return lines.join("<br>");
    })();

    return {
      template: s?.invoiceTemplate || "professional",
      language,
      customLabels: language === "custom" ? invoiceLabelData?.labels : undefined,
      businessName: s?.businessName || "Your Business",
      businessMeta: (s as any)?.businessTagline || "",
      businessAddress: [s?.businessAddress, s?.businessCity, s?.businessState].filter(Boolean).join(", "),
      businessEmail: s?.businessEmail || "",
      businessPhone: s?.businessPhone || "",
      invoiceNumber: propInvoiceNumber || invoiceNumber || "PREVIEW",
      issueDate,
      dueDate: showDueDate ? dueDate : "",
      clientName: c?.name || "Client",
      clientAddress: c?.address || "",
      clientCity: c?.city || "",
      clientState: c?.state || "",
      clientZip: c?.zipCode || "",
      clientEmail: c?.email || "",
      lineItems,
      subtotalFormatted: subtotal.toFixed(2),
      taxFormatted: taxAmount.toFixed(2),
      taxLabel: enableTax && taxRate > 0 ? `Tax (${taxRate}%)` : "Tax",
      totalFormatted: totalAmount.toFixed(2),
      notes,
      showNotes: showInvoiceNotes,
      currency,
      logoUrl: (s as any)?.companyLogo || undefined,
      showLogo: (s as any)?.showLogo !== false,
      logoSize: (s as any)?.logoSize || "64",
      primaryColor: (s as any)?.invoiceColorTheme || undefined,
      accentColor: (s as any)?.invoiceAccentColor || undefined,
      textColor: (s as any)?.invoiceTextColor || undefined,
      bgColor: (s as any)?.invoiceBackgroundColor || undefined,
      showDateColumn: (s as any)?.showDateColumn === true,
      showHourlyRate: (s as any)?.showHourlyRate !== false,
      showProjectName: (s as any)?.showProjectName !== false,
      paymentDetails,
      showPaymentDetails: !!(s as any)?.showBankDetails && !!paymentDetails,
      paymentTerms: (s as any)?.paymentTerms || "",
      showPaymentTerms: (s as any)?.showPaymentTerms === true,
      footerNotes: (s as any)?.invoiceFooterText || "",
      showFooterNotes: (s as any)?.showFooterNotes !== false,
      watermarkPreview: invoiceAccess.watermarkPreview,
      watermarkLogoUrl: invoiceAccess.watermarkPreview ? tickdLogoFull : undefined,
    };
  }, [groupedInvoiceEntries, additionalItems, notes, showInvoiceNotes, effectiveSettings, activeClient, invoiceNumber, propInvoiceNumber, subtotal, taxRate, enableTax, issueDate, dueDate, showDueDate, reportData, reportUsesWeeklyGrouping, getAdditionalItemsTotal, invoiceLabelData, invoiceAccess.watermarkPreview]);

  const htmlString = useMemo(() => generateInvoiceHTML(templateData), [templateData]);

  const handleExportPdf = async () => {
    if (!invoiceAccess.canExport) {
      toast({ title: "Pro feature", description: "Upgrade to Pro to export clean, selectable-text invoices." });
      return;
    }
    if (!activeClient) return;
    setPdfLoading(true);
    try {
      const timestamp = new Date().getTime();
      const filename = `invoice-${(propInvoiceNumber || invoiceNumber).replace("INV-", "")}-${timestamp}.pdf`;
      await exportInvoicePdf(templateData, filename);
      toast({ title: "Invoice exported", description: `Saved as ${filename}` });
    } catch (err) {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : "Could not generate PDF.", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleEditInvoiceSettings = () => {
    sessionStorage.setItem("tickd.invoiceSettingsPreview", JSON.stringify(templateData));
    if (activeClient?.id) {
      navigate(`/clients?edit=${activeClient.id}&invoiceProfile=1`);
    } else {
      navigate("/settings?tab=invoice&preview=generated");
    }
  };

  if (!reportData || !activeClient || !activeSettings || !effectiveSettings) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentTemplate = effectiveSettings?.invoiceTemplate || "professional";
  const templateLabel = currentTemplate.charAt(0).toUpperCase() + currentTemplate.slice(1);

  return (
    <div className="bg-white shadow rounded-lg mb-6">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Invoice Preview — {templateLabel} Template</h2>
        <p className="mt-1 text-sm text-gray-500">{propInvoiceNumber || invoiceNumber || "PREVIEW"}</p>
      </div>

      <div className="p-6">
        {invoiceAccess.watermarkPreview && (
          <div className="mb-5 flex flex-col gap-4 rounded-md border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-blue-600 shadow-sm">
                <Lock className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-blue-950">Free invoice preview</p>
                <p className="mt-1 text-sm leading-5 text-blue-800">Build and review the complete invoice with a Tickd watermark. Pro removes the watermark and unlocks saving and selectable-text PDF export.</p>
              </div>
            </div>
            <Button className="shrink-0 rounded-md" size="sm" onClick={() => navigate("/plans")}>
              <Sparkles className="mr-2 h-4 w-4" /> Upgrade to Pro
            </Button>
          </div>
        )}

        {/* Invoice template preview */}
        <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden" style={{ background: "#f1f3f5" }}>
          <div style={{ width: "100%", overflowX: "auto", padding: "16px" }}>
            <div
              style={{
                width: "794px",
                minHeight: "1123px",
                transformOrigin: "top left",
                transform: "scale(0.72)",
                marginBottom: "-322px",
              }}
            >
              <iframe
                srcDoc={htmlString}
                width="794"
                height="1123"
                style={{ border: "none", display: "block", width: "794px", height: "1123px" }}
                title="Invoice Preview"
              />
            </div>
          </div>
        </div>

        {/* Edit controls */}
        <div className="space-y-4">
          {/* Time entries table (editable when isEditing) */}
          {isEditing && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Time Entries</div>
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 w-24">Hours</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 w-24">Rate</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableEntries.map((entry) => {
                      const duration =
                        typeof entry.editedDuration === "number" ? entry.editedDuration : parseFloat(entry.duration || "0");
                      const amount =
                        typeof entry.editedAmount === "number" ? entry.editedAmount : parseFloat(entry.amount?.toString() || "0");
                      const rate = parseFloat(entry.hourlyRate || entry.project?.hourlyRate || "0");
                      const currency = activeClient?.currency || "USD";
                      return (
                        <tr key={entry.id} className="border-b border-gray-100">
                          <td className="px-3 py-2 text-gray-900">{entry.description}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="text"
                              className="w-20 h-7 p-1 text-sm"
                              defaultValue={formatHoursForInput(duration, reportData.timeFormat as TimeFormat)}
                              onBlur={(e) => updateEntryDuration(entry.id, parseTime(e.target.value, reportData.timeFormat as TimeFormat), reportData.timeFormat as TimeFormat)}
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-600">{formatCurrency(rate, currency)}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(amount, currency)}</td>
                        </tr>
                      );
                    })}
                    {additionalItems.map((item) => (
                      <tr key={`add-${item.id}`} className="border-b border-gray-100 bg-blue-50/30">
                        <td className="px-3 py-2">
                          <Input
                            type="text"
                            className="h-7 p-1 text-sm"
                            value={item.description}
                            onChange={(e) => updateAdditionalItem(item.id, "description", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-400">—</td>
                        <td className="px-3 py-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => removeItem(item.id)}>
                            <Minus className="h-3 w-3 text-red-500" />
                          </Button>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            className="w-24 h-7 p-1 text-sm text-right"
                            defaultValue={item.amount.toString()}
                            onBlur={(e) => updateAdditionalItem(item.id, "amount", e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-center border-t border-dashed border-gray-200">
                        <Button variant="ghost" size="sm" onClick={addItem} className="text-blue-600">
                          <Plus className="mr-1 h-3 w-3" />
                          Add Item
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50/50 p-3">
            <h3 className="text-sm font-medium text-gray-700">Invoice dates</h3>
            <InvoiceDateFields
              issueDate={issueDateValue}
              dueDate={dueDateValue}
              mode={dueDateMode}
              days={dueDateDays}
              showDueDate={showDueDate}
              onIssueDateChange={setIssueDateValue}
              onDueDateChange={(value) => {
                setDueDateValue(value);
                setDueDate?.(value);
              }}
              onModeChange={setDueDateMode}
              onDaysChange={setDueDateDays}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={showInvoiceNotes}
                onChange={(event) => setShowInvoiceNotes(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Show notes
            </label>
            {showInvoiceNotes && (
              <Textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  if (propSetNotes) propSetNotes(e.target.value);
                }}
                className="text-sm text-gray-600 bg-gray-50 h-20"
                placeholder="Add notes or payment instructions..."
              />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onEditInvoice}>
              <Edit className="mr-2 h-4 w-4" />
              {isEditing ? "Done Editing" : "Edit Entries"}
            </Button>
            <div className="space-x-2">
              <Button variant="outline" onClick={handleEditInvoiceSettings}>
                {activeClient?.id ? "Edit client invoice profile" : "Edit invoice settings"}
              </Button>
              <Button variant="outline" onClick={handleCreateInvoice} disabled={!invoiceAccess.canSave} title={!invoiceAccess.canSave ? "Upgrade to Pro to save invoices" : undefined}>
                {invoiceAccess.canSave ? <FileSpreadsheet className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                Save Invoice
              </Button>
              <Button onClick={handleExportPdf} disabled={pdfLoading || !invoiceAccess.canExport} title={!invoiceAccess.canExport ? "Upgrade to Pro to export invoices" : undefined}>
                {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : invoiceAccess.canExport ? <File className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
