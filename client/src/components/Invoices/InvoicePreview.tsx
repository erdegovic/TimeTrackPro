import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit, FileSpreadsheet, File, Plus, Minus, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatTime, formatCurrency, parseTime } from "@/lib/utils/timeUtils";
import { Client, Settings, TimeFormat } from "@shared/schema";
import { generateInvoiceHTML, InvoiceTemplateData } from "@/lib/invoice-html-generator";
import { exportInvoicePdf } from "@/lib/invoice-pdf";

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
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [editableEntries, setEditableEntries] = useState<any[]>([]);
  const [additionalItems, setAdditionalItems] = useState<{ description: string; amount: number; id: number }[]>(
    propAdditionalItems || []
  );
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [notes, setNotes] = useState(propNotes || "");
  const [showDueDate, setShowDueDate] = useState(propShowDueDate !== undefined ? propShowDueDate : true);
  const [taxRate, setTaxRate] = useState(0);
  const [enableTax, setEnableTax] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: invoiceNumberData } = useQuery({
    queryKey: ["/api/next-invoice-number"],
    queryFn: async () => {
      const res = await fetch("/api/next-invoice-number");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  useEffect(() => {
    if (invoiceNumberData?.invoiceNumber) setInvoiceNumber(invoiceNumberData.invoiceNumber);
  }, [invoiceNumberData]);

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

  const activeClient = propClient || client;
  const activeSettings = propSettings || settings;

  useEffect(() => {
    if (activeSettings) {
      const taxEnabled = typeof activeSettings.enableTax === "boolean" ? activeSettings.enableTax : false;
      const rate =
        typeof activeSettings.defaultTaxRate === "number"
          ? activeSettings.defaultTaxRate
          : parseFloat(activeSettings.defaultTaxRate?.toString() || "0");
      setEnableTax(taxEnabled);
      setTaxRate(rate);
      if (typeof activeSettings.showDueDate === "boolean") setShowDueDate(activeSettings.showDueDate);
    }
  }, [activeSettings]);

  const issueDate = propIssueDate || format(new Date(), "MMMM d, yyyy");
  const dueDate = propDueDate || format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), "MMMM d, yyyy");

  useEffect(() => {
    if (reportData?.timeEntries) {
      const data = reportData.timeEntries.map((e: any) => ({
        ...e,
        originalDuration: e.adjustedDuration || e.duration,
        editedDuration: e.adjustedDuration || e.duration,
        originalAmount: parseFloat(e.amount),
      }));
      setEditableEntries(data);
      setSubtotal(reportData.totalAmount);
      const tax = enableTax ? reportData.totalAmount * (taxRate / 100) : 0;
      setTotal(reportData.totalAmount + tax);
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
    if (!reportData || !activeClient) {
      toast({ title: "Error", description: "Missing client or report data", variant: "destructive" });
      return;
    }
    try {
      const timeEntryIds = reportData.timeEntries.map((e: any) => e.id);
      const entriesSubtotal = editableEntries.reduce((s, e) => s + parseFloat(e.amount.toString()), 0);
      const additionalItemsTotal = additionalItems.reduce((s, i) => s + (i.amount || 0), 0);
      const invoiceSubtotal = entriesSubtotal;
      const tax = enableTax ? invoiceSubtotal * (taxRate / 100) : 0;
      const invoiceTotal = invoiceSubtotal + additionalItemsTotal + tax;

      const lineItemsData = [
        ...editableEntries.map((e: any) => ({
          timeEntryId: e.id,
          isTimeEntry: true,
          description: e.description,
          hours: typeof e.editedDuration === "number" ? e.editedDuration : parseFloat(e.duration || "0"),
          rate: parseFloat(e.hourlyRate || e.project?.hourlyRate || "0"),
          amount: typeof e.editedAmount === "number" ? e.editedAmount : parseFloat(e.amount?.toString() || "0"),
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
        issueDate: format(new Date(issueDate), "yyyy-MM-dd"),
        dueDate: format(new Date(dueDate), "yyyy-MM-dd"),
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

    const lineItems = [
      ...editableEntries.map((e) => {
        const duration = typeof e.editedDuration === "number" ? e.editedDuration : parseFloat(e.duration || "0");
        const amount = typeof e.editedAmount === "number" ? e.editedAmount : parseFloat(e.amount?.toString() || "0");
        const rate = parseFloat(e.hourlyRate || e.project?.hourlyRate || "0");
        return {
          description: e.description || "Service",
          subDescription: e.project?.name || "",
          qty: formatTime(duration, timeFormat),
          rate: formatCurrency(rate, currency),
          amount: formatCurrency(amount, currency),
        };
      }),
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

    const s = activeSettings;
    const c = activeClient;
    return {
      template: s?.invoiceTemplate || "professional",
      businessName: s?.businessName || "Your Business",
      businessMeta: (s as any)?.businessTagline || "",
      businessAddress: [s?.businessAddress, s?.businessCity, s?.businessState].filter(Boolean).join(", "),
      businessEmail: s?.businessEmail || "",
      businessPhone: s?.businessPhone || "",
      invoiceNumber: propInvoiceNumber || invoiceNumber,
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
      currency,
      logoUrl: (s as any)?.companyLogo || undefined,
      showLogo: (s as any)?.showLogo !== false,
      logoSize: (s as any)?.logoSize || "64",
      primaryColor: (s as any)?.invoiceColorTheme || undefined,
      accentColor: (s as any)?.invoiceAccentColor || undefined,
      textColor: (s as any)?.invoiceTextColor || undefined,
      bgColor: (s as any)?.invoiceBackgroundColor || undefined,
    };
  }, [editableEntries, additionalItems, notes, activeSettings, activeClient, invoiceNumber, propInvoiceNumber, subtotal, taxRate, enableTax, issueDate, dueDate, showDueDate, reportData, getAdditionalItemsTotal]);

  const htmlString = useMemo(() => generateInvoiceHTML(templateData), [templateData]);

  const handleExportPdf = async () => {
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

  if (!reportData || !activeClient || !activeSettings) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentTemplate = activeSettings?.invoiceTemplate || "professional";
  const templateLabel = currentTemplate.charAt(0).toUpperCase() + currentTemplate.slice(1);

  return (
    <div className="bg-white shadow rounded-lg mb-6">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Invoice Preview — {templateLabel} Template</h2>
        <p className="mt-1 text-sm text-gray-500">{propInvoiceNumber || invoiceNumber}</p>
      </div>

      <div className="p-6">
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
                              defaultValue={formatTime(duration, reportData.timeFormat as TimeFormat)}
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

          {/* Notes */}
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Notes</div>
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (propSetNotes) propSetNotes(e.target.value);
              }}
              className="text-sm text-gray-600 bg-gray-50 h-20"
              placeholder="Add notes or payment instructions..."
            />
          </div>

          {/* Action buttons */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onEditInvoice}>
              <Edit className="mr-2 h-4 w-4" />
              {isEditing ? "Done Editing" : "Edit Entries"}
            </Button>
            <div className="space-x-2">
              <Button variant="outline" onClick={handleCreateInvoice}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Save Invoice
              </Button>
              <Button onClick={handleExportPdf} disabled={pdfLoading}>
                {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <File className="mr-2 h-4 w-4" />}
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
