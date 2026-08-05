import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Save, FileDown, X, Plus, Trash2, ChevronDown, Send, DollarSign, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/enhanced-pdf-generator";
import { Invoice, Client, Settings } from "@shared/schema";
import { formatCurrency } from "@/lib/utils/timeUtils";
import { InvoiceDateFields } from "./InvoiceDateFields";
import { DueDateMode } from "@/lib/invoice-dates";

interface LineItem {
  id: number;
  description: string;
  hours?: number;
  rate?: number;
  amount: number;
  isTimeEntry?: boolean;
  timeEntryId?: number;
}

interface InvoiceEditorProps {
  invoice: Invoice;
  onClose: () => void;
  onSave: () => void;
}

export default function InvoiceEditor({ invoice, onClose, onSave }: InvoiceEditorProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber);
  const [issueDate, setIssueDate] = useState(invoice.issueDate);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [dueDateMode, setDueDateMode] = useState<DueDateMode>("manual");
  const [dueDateDays, setDueDateDays] = useState(30);
  const [status, setStatus] = useState(invoice.status);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });
  const client = clients.find(c => c.id === invoice.clientId);
  const currency = client?.currency || settings?.defaultCurrency || "USD";

  useEffect(() => {
    if (clients.length > 0 && !dataLoaded) {
      loadInvoiceData();
    }
  }, [clients.length, invoice.id]);

  const loadInvoiceData = async () => {
    setIsLoading(true);
    try {
      let cleanNotes = invoice.notes || "";
      let storedLineItems: LineItem[] = [];

      if (invoice.lineItems) {
        try { storedLineItems = JSON.parse(invoice.lineItems); } catch {}
      }

      if (cleanNotes.includes("ADDITIONAL_ITEMS:")) {
        const parts = cleanNotes.split("ADDITIONAL_ITEMS:");
        cleanNotes = parts[0].trim();
        if (!storedLineItems.length) {
          try {
            const legacyItems = JSON.parse(parts[1].split("\n\nEDITED_ENTRIES:")[0].trim());
            storedLineItems = legacyItems.map((item: any) => ({
              id: item.id || Date.now(),
              description: item.description,
              amount: parseFloat(String(item.amount)) || 0,
            }));
          } catch {}
        }
      }
      if (cleanNotes.includes("EDITED_ENTRIES:")) {
        cleanNotes = cleanNotes.split("EDITED_ENTRIES:")[0].split("ADDITIONAL_ITEMS:")[0].trim();
      }
      setNotes(cleanNotes);

      const res = await fetch("/api/time-entries");
      const allEntries = await res.json();
      const invoiceEntries = allEntries.filter((e: any) => e.invoiceId === invoice.id);

      const timeEntryItems: LineItem[] = invoiceEntries.map((entry: any) => {
        const hourlyRate = parseFloat(entry.project?.hourlyRate || entry.hourlyRate || "0");
        const duration = parseFloat(entry.duration || "0");
        const stored = storedLineItems.find(i => i.timeEntryId === entry.id);
        return {
          id: entry.id,
          timeEntryId: entry.id,
          isTimeEntry: true,
          description: entry.description || "Time Entry",
          hours: stored?.hours ?? duration,
          rate: stored?.rate ?? hourlyRate,
          amount: stored?.amount ?? (hourlyRate * duration),
        };
      });

      const customItems = storedLineItems.filter(i => !i.isTimeEntry);
      setLineItems([...timeEntryItems, ...customItems]);
      setDataLoaded(true);
    } catch (err) {
      console.error("Failed to load invoice data:", err);
      toast({ title: "Error", description: "Failed to load invoice data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const subtotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const taxRate = parseFloat(String(invoice.taxRate || "0"));
  const taxEnabled = settings?.enableTax || taxRate > 0;
  const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : parseFloat(String(invoice.tax || "0"));
  const total = subtotal + taxAmount;

  const updateLineItem = (id: number, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === "hours" || field === "rate") {
        updated.amount = (Number(updated.hours) || 0) * (Number(updated.rate) || 0);
      }
      return updated;
    }));
  };

  const addCustomLineItem = () => {
    setLineItems(prev => [...prev, { id: Date.now(), description: "Custom item", amount: 0 }]);
  };

  const removeLineItem = (id: number) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const saveInvoice = async () => {
    setIsLoading(true);
    try {
      const allItemsForStorage = lineItems.map(item => ({
        id: item.id, timeEntryId: item.timeEntryId, isTimeEntry: item.isTimeEntry,
        description: item.description, hours: item.hours, rate: item.rate, amount: item.amount,
      }));

      await apiRequest("PUT", `/api/invoices/${invoice.id}`, {
        invoiceNumber, issueDate, dueDate, status, notes,
        lineItems: JSON.stringify(allItemsForStorage),
        subtotal: subtotal.toFixed(2),
        tax: taxAmount.toFixed(2),
        taxRate: String(taxRate),
        total: total.toFixed(2),
        clientId: invoice.clientId,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice saved", description: "Changes saved successfully." });
      onSave();
    } catch (err) {
      toast({ title: "Error", description: "Failed to save invoice.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!client || !settings) return;
    setIsLoading(true);
    try {
      const timeItems = lineItems.filter(i => i.isTimeEntry);
      const customItems = lineItems.filter(i => !i.isTimeEntry);
      const reportData = {
        timeEntries: timeItems.map(item => ({
          id: item.id, description: item.description,
          duration: item.hours || 0, amount: item.amount,
          editedDuration: item.hours, editedAmount: item.amount,
          hourlyRate: String(item.rate || 0),
          project: { hourlyRate: String(item.rate || 0) },
        })),
        additionalItems: customItems.map(item => ({ id: item.id, description: item.description, amount: item.amount })),
        totalHours: timeItems.reduce((s, i) => s + (i.hours || 0), 0),
        totalAmount: total,
        timeFormat: settings.defaultTimeFormat || "decimal",
        clientCurrency: currency,
      };

      await generatePdf({
        filename: `invoice-${invoiceNumber}.pdf`,
        type: "invoice",
        invoice: { ...invoice, invoiceNumber, issueDate, dueDate, notes, subtotal: String(subtotal), tax: String(taxAmount), total: String(total) } as Invoice,
        reportData, client, settings, invoiceNumber, issueDate, dueDate, notes, showDueDate: true,
      });
      toast({ title: "PDF exported", description: `invoice-${invoiceNumber}.pdf downloaded.` });
    } catch (err) {
      toast({ title: "Error", description: "Failed to export PDF.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
    sent: { label: "Sent", className: "bg-blue-100 text-blue-700 border-blue-200" },
    paid: { label: "Paid", className: "bg-green-100 text-green-700 border-green-200" },
  };

  if (isLoading && !dataLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const statusDot: Record<string, string> = {
    draft: "bg-gray-400",
    sent: "bg-blue-500",
    paid: "bg-green-500",
  };

  return (
    <div className="flex flex-col">
      {/* Colored header band */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-t-lg px-6 py-5 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Invoice</p>
            <h2 className="text-2xl font-bold tracking-tight">{invoiceNumber}</h2>
            <p className="text-sm text-gray-300 mt-0.5">{client?.name || "Unknown Client"}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white border border-white/20 hover:bg-white/10 gap-2">
                  <span className={`w-2 h-2 rounded-full ${statusDot[status] || statusDot.draft}`} />
                  {(statusConfig[status] || statusConfig.draft).label}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatus("draft")}>
                  <span className="w-2 h-2 rounded-full bg-gray-400 mr-2 flex-shrink-0" /> Draft
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatus("sent")}>
                  <Send className="h-3 w-3 mr-2 text-blue-500 flex-shrink-0" /> Sent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatus("paid")}>
                  <DollarSign className="h-3 w-3 mr-2 text-green-500 flex-shrink-0" /> Paid
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" onClick={exportPdf} disabled={isLoading} className="text-white border border-white/20 hover:bg-white/10">
              <FileDown className="h-4 w-4 mr-1.5" /> PDF
            </Button>
            <Button size="sm" onClick={saveInvoice} disabled={isLoading} className="bg-white text-gray-900 hover:bg-gray-100 font-semibold">
              <Save className="h-4 w-4 mr-1.5" /> Save
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Issued</p>
            <p className="text-sm font-medium mt-0.5">{issueDate || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Due</p>
            <p className="text-sm font-medium mt-0.5">{dueDate || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
            <p className="text-lg font-bold mt-0.5">{formatCurrency(total, currency)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 p-6">
        {/* Metadata + Client row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Invoice fields */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Invoice Details</p>
            <div>
              <Label htmlFor="invoiceNumber" className="text-xs text-gray-500">Invoice Number</Label>
              <Input id="invoiceNumber" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="mt-1 h-9" />
            </div>
            <InvoiceDateFields
              issueDate={issueDate}
              dueDate={dueDate}
              mode={dueDateMode}
              days={dueDateDays}
              showDueDate={settings?.showDueDate !== false}
              onIssueDateChange={setIssueDate}
              onDueDateChange={setDueDate}
              onModeChange={setDueDateMode}
              onDaysChange={setDueDateDays}
            />
          </div>

          {/* Client */}
          {client && (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Bill To</p>
              <p className="font-semibold text-gray-900">{client.name}</p>
              {client.email && <p className="text-sm text-gray-500 mt-0.5">{client.email}</p>}
              {client.address && <p className="text-sm text-gray-500">{client.address}</p>}
              {(client.city || client.state) && (
                <p className="text-sm text-gray-500">{[client.city, client.state, client.zipCode].filter(Boolean).join(", ")}</p>
              )}
            </div>
          )}
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Line Items</p>
            <Button variant="outline" size="sm" onClick={addCustomLineItem} className="h-8 text-xs gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Item
            </Button>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 bg-gray-50 border-b px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <div className="col-span-5">Description</div>
              <div className="col-span-2 text-center">Hours</div>
              <div className="col-span-2 text-center">Rate</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-1" />
            </div>

            {lineItems.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500">No line items</p>
                <p className="text-xs text-gray-400 mt-0.5">Time entries linked to this invoice will appear here.</p>
              </div>
            ) : (
              lineItems.map((item, idx) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-12 items-center px-4 py-3 border-b last:border-b-0 gap-2 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                >
                  <div className="col-span-12 sm:col-span-5">
                    <Input
                      value={item.description}
                      onChange={e => updateLineItem(item.id, "description", e.target.value)}
                      className="h-8 text-sm border-gray-200 focus:border-gray-400"
                      placeholder="Description"
                    />
                    {item.isTimeEntry && (
                      <span className="text-xs text-blue-500 font-medium ml-1 mt-0.5 inline-block">Time entry</span>
                    )}
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number" step="0.01" min="0"
                      value={item.hours ?? ""}
                      onChange={e => updateLineItem(item.id, "hours", parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm text-center border-gray-200"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number" step="0.01" min="0"
                      value={item.rate ?? ""}
                      onChange={e => updateLineItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm text-center border-gray-200"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2 text-right">
                    {item.isTimeEntry ? (
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.amount, currency)}</span>
                    ) : (
                      <Input
                        type="number" step="0.01" min="0"
                        value={item.amount}
                        onChange={e => updateLineItem(item.id, "amount", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm text-right border-gray-200"
                      />
                    )}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors rounded-lg"
                      onClick={() => removeLineItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Totals + Notes row */}
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* Notes */}
          <div className="flex-1 w-full">
            <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-widest text-gray-400">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Payment terms, bank details, thank you message..."
              className="mt-2 h-28 resize-none text-sm border-gray-200"
            />
          </div>

          {/* Totals */}
          <div className="w-full sm:w-64 shrink-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Summary</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium text-gray-900">{formatCurrency(subtotal, currency)}</span>
              </div>
              {(taxEnabled || taxAmount > 0) && (
                <div className="px-4 py-3 border-t flex justify-between text-sm text-gray-600">
                  <span>Tax{taxRate > 0 ? ` (${taxRate}%)` : ""}</span>
                  <span>{formatCurrency(taxAmount, currency)}</span>
                </div>
              )}
              <div className="px-4 py-3 bg-gray-900 flex justify-between items-center">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-base font-bold text-white">{formatCurrency(total, currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
