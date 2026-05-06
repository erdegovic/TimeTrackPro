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

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Edit Invoice</h2>
          <p className="text-sm text-gray-500 mt-0.5">{client?.name || "Unknown Client"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${(statusConfig[status] || statusConfig.draft).className}`}>
                  {(statusConfig[status] || statusConfig.draft).label}
                </span>
                <ChevronDown className="h-3 w-3 text-gray-500" />
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
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={isLoading}>
            <FileDown className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button size="sm" onClick={saveInvoice} disabled={isLoading}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Invoice Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="invoiceNumber" className="text-xs font-medium text-gray-600">Invoice Number</Label>
          <Input id="invoiceNumber" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="issueDate" className="text-xs font-medium text-gray-600">Issue Date</Label>
          <Input id="issueDate" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="dueDate" className="text-xs font-medium text-gray-600">Due Date</Label>
          <Input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1" />
        </div>
      </div>

      {/* Client */}
      {client && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Bill To</p>
          <p className="font-semibold text-gray-900">{client.name}</p>
          {client.email && <p className="text-sm text-gray-600">{client.email}</p>}
          {client.address && <p className="text-sm text-gray-600">{client.address}</p>}
          {(client.city || client.state) && (
            <p className="text-sm text-gray-600">{[client.city, client.state, client.zipCode].filter(Boolean).join(", ")}</p>
          )}
        </div>
      )}

      <Separator />

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Line Items</h3>
          <Button variant="outline" size="sm" onClick={addCustomLineItem}>
            <Plus className="h-4 w-4 mr-1" /> Add Line Item
          </Button>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 bg-gray-50 border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <div className="col-span-5">Description</div>
            <div className="col-span-2 text-center">Hours</div>
            <div className="col-span-2 text-center">Rate</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-1" />
          </div>

          {lineItems.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No line items found. Time entries for this invoice will appear here.</p>
            </div>
          ) : (
            lineItems.map((item, idx) => (
              <div key={item.id} className={`grid grid-cols-12 items-center px-4 py-2.5 border-b last:border-b-0 gap-2 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                <div className="col-span-12 sm:col-span-5">
                  <Input
                    value={item.description}
                    onChange={e => updateLineItem(item.id, "description", e.target.value)}
                    className="h-8 text-sm"
                    placeholder="Description"
                  />
                  {item.isTimeEntry && <span className="text-xs text-blue-500 ml-1">Time entry</span>}
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input
                    type="number" step="0.01" min="0"
                    value={item.hours ?? ""}
                    onChange={e => updateLineItem(item.id, "hours", parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm text-center"
                    placeholder="hrs"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input
                    type="number" step="0.01" min="0"
                    value={item.rate ?? ""}
                    onChange={e => updateLineItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm text-center"
                    placeholder="rate"
                  />
                </div>
                <div className="col-span-3 sm:col-span-2 text-right">
                  {item.isTimeEntry ? (
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(item.amount, currency)}</span>
                  ) : (
                    <Input
                      type="number" step="0.01" min="0"
                      value={item.amount}
                      onChange={e => updateLineItem(item.id, "amount", parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm text-right"
                    />
                  )}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-300 hover:text-red-500 transition-colors" onClick={() => removeLineItem(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full sm:w-72 space-y-2 rounded-lg border p-4 bg-gray-50">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
          </div>
          {(taxEnabled || taxAmount > 0) && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax{taxRate > 0 ? ` (${taxRate}%)` : ""}</span>
              <span>{formatCurrency(taxAmount, currency)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-gray-900">
            <span>Total</span>
            <span className="text-lg">{formatCurrency(total, currency)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes" className="text-xs font-medium text-gray-600">Notes / Payment Instructions</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Payment terms, bank details, thank you message..."
          className="mt-1 h-28 resize-none"
        />
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf} disabled={isLoading}>
            <FileDown className="h-4 w-4 mr-1" /> Export PDF
          </Button>
          <Button onClick={saveInvoice} disabled={isLoading}>
            <Save className="h-4 w-4 mr-1" /> Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
