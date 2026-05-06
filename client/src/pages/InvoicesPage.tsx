import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  FileText, Trash2, FileDown, Edit, Plus, CheckCircle, Send, Clock, MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/enhanced-pdf-generator";
import { Invoice, Client, Settings } from "@shared/schema";
import InvoiceEditor from "../components/Invoices/InvoiceEditor";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline"; icon: any; className: string }> = {
  draft:  { label: "Draft",  variant: "secondary", icon: Clock,        className: "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200" },
  sent:   { label: "Sent",   variant: "outline",   icon: Send,         className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
  paid:   { label: "Paid",   variant: "default",   icon: CheckCircle,  className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" },
};

function getCurrencySymbol(currency: string) {
  return currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency === "RSD" ? "RSD " : "$";
}

export default function InvoicesPage() {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    staleTime: 0,
  });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });

  const deleteInvoice = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice deleted" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/invoices/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Status updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update status.", variant: "destructive" }),
  });

  const handleExportPdf = async (invoice: Invoice) => {
    const client = clients.find(c => c.id === invoice.clientId);
    if (!client || !settings) {
      toast({ title: "Error", description: "Missing client or business details.", variant: "destructive" });
      return;
    }

    try {
      const [invoiceRes, entriesRes] = await Promise.all([
        fetch(`/api/invoices/${invoice.id}`),
        fetch("/api/time-entries"),
      ]);
      const invoiceData = await invoiceRes.json();
      const allEntries = await entriesRes.json();
      const invoiceEntries = allEntries.filter((e: any) => e.invoiceId === invoice.id);

      let cleanNotes = invoiceData.notes || "";
      let additionalItems: any[] = [];

      // Support new lineItems field
      if (invoiceData.lineItems) {
        try {
          const parsed = JSON.parse(invoiceData.lineItems);
          additionalItems = parsed.filter((i: any) => !i.isTimeEntry);
          // Apply stored edits to time entries
          invoiceEntries.forEach((entry: any) => {
            const stored = parsed.find((i: any) => i.timeEntryId === entry.id);
            if (stored) {
              entry.duration = String(stored.hours ?? entry.duration);
              entry.editedDuration = stored.hours;
              entry.editedAmount = stored.amount;
              entry.amount = String(stored.amount ?? entry.amount);
            }
          });
        } catch {}
      } else if (cleanNotes.includes("ADDITIONAL_ITEMS:")) {
        const parts = cleanNotes.split("ADDITIONAL_ITEMS:");
        cleanNotes = parts[0].trim();
        try { additionalItems = JSON.parse(parts[1].trim()); } catch {}
      }
      if (cleanNotes.includes("EDITED_ENTRIES:")) {
        cleanNotes = cleanNotes.split("EDITED_ENTRIES:")[0].split("ADDITIONAL_ITEMS:")[0].trim();
      }

      const currency = client.currency || settings.defaultCurrency || "USD";
      const reportData = {
        timeEntries: invoiceEntries,
        additionalItems,
        clientCurrency: currency,
        totalHours: invoiceEntries.reduce((s: number, e: any) => s + parseFloat(e.duration || "0"), 0),
        totalAmount: Number(invoiceData.total),
        timeFormat: settings.defaultTimeFormat || "decimal",
      };

      await generatePdf({
        filename: `invoice-${invoiceData.invoiceNumber}.pdf`,
        type: "invoice",
        invoice: { ...invoiceData, notes: cleanNotes } as Invoice,
        reportData,
        client,
        settings,
        invoiceNumber: invoiceData.invoiceNumber,
        issueDate: invoiceData.issueDate,
        dueDate: invoiceData.dueDate,
        notes: cleanNotes,
        showDueDate: true,
      });

      toast({ title: "PDF exported", description: `invoice-${invoiceData.invoiceNumber}.pdf downloaded.` });
    } catch (err) {
      console.error("Export error:", err);
      toast({ title: "Error", description: "Failed to export PDF.", variant: "destructive" });
    }
  };

  const openEdit = async (invoice: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`);
      const full = await res.json();
      setEditingInvoice(full);
    } catch {
      toast({ title: "Error", description: "Failed to load invoice.", variant: "destructive" });
    }
  };

  // Stats
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
  const outstanding = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + Number(i.total), 0);
  const unpaidCount = invoices.filter(i => i.status !== "paid").length;

  const sortedInvoices = [...invoices].sort((a, b) =>
    new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage your invoices and track payments.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Paid</p>
                <p className="text-xl font-bold text-gray-900">${totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Outstanding</p>
                <p className="text-xl font-bold text-gray-900">${outstanding.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Invoices</p>
                <p className="text-xl font-bold text-gray-900">{invoices.length}</p>
                {unpaidCount > 0 && <p className="text-xs text-amber-600">{unpaidCount} unpaid</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>Click the status badge to quickly update payment status</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : sortedInvoices.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="font-semibold text-gray-900">No invoices yet</h3>
              <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
                Generate a report from the Reports page, then create an invoice from there.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-6 py-3 text-left">Invoice #</th>
                    <th className="px-6 py-3 text-left">Client</th>
                    <th className="px-6 py-3 text-left">Issue Date</th>
                    <th className="px-6 py-3 text-left">Due Date</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedInvoices.map(invoice => {
                    const client = clients.find(c => c.id === invoice.clientId);
                    const currency = client?.currency || "USD";
                    const symbol = getCurrencySymbol(currency);
                    const sc = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
                    const StatusIcon = sc.icon;

                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4 font-semibold text-gray-900">{invoice.invoiceNumber}</td>
                        <td className="px-6 py-4 text-gray-700">{client?.name || "Unknown"}</td>
                        <td className="px-6 py-4 text-gray-500">
                          {(() => { try { return format(new Date(invoice.issueDate), "MMM d, yyyy"); } catch { return invoice.issueDate; } })()}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {(() => { try { return format(new Date(invoice.dueDate), "MMM d, yyyy"); } catch { return invoice.dueDate; } })()}
                        </td>
                        <td className="px-6 py-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors ${sc.className}`}>
                                <StatusIcon className="h-3 w-3" />
                                {sc.label}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-40">
                              <DropdownMenuItem
                                onClick={() => updateStatus.mutate({ id: invoice.id, status: "draft" })}
                                className="gap-2"
                              >
                                <Clock className="h-3.5 w-3.5 text-gray-500" /> Draft
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateStatus.mutate({ id: invoice.id, status: "sent" })}
                                className="gap-2"
                              >
                                <Send className="h-3.5 w-3.5 text-blue-500" /> Mark as Sent
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateStatus.mutate({ id: invoice.id, status: "paid" })}
                                className="gap-2"
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Mark as Paid
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                          {symbol}{Number(invoice.total).toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-gray-700"
                              title="Edit Invoice"
                              onClick={() => openEdit(invoice)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-gray-700"
                              title="Export PDF"
                              onClick={() => handleExportPdf(invoice)}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-red-600"
                              title="Delete"
                              onClick={() => setDeleteId(invoice.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The invoice will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteInvoice.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Invoice Dialog */}
      <Dialog open={editingInvoice !== null} onOpenChange={open => !open && setEditingInvoice(null)}>
        <DialogContent className="w-[95vw] max-w-[800px] max-h-[90vh] overflow-y-auto">
          {editingInvoice && (
            <InvoiceEditor
              invoice={editingInvoice}
              onSave={() => {
                setEditingInvoice(null);
                queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
              }}
              onClose={() => setEditingInvoice(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
