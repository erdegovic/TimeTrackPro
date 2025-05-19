import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { File, FileText, Trash2, Download, Edit, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/pdf-generator";
import { Invoice, Client, Settings } from "@shared/schema";
// Make sure to use relative path for imports
import InvoiceEditor from "../components/Invoices/SimpleInvoiceEditor";

export default function InvoicesPage() {
  const { toast } = useToast();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Fetch invoices with a shorter cache time to ensure data is fresh
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    staleTime: 5000, // 5 seconds stale time to ensure more frequent refreshes
  });
  
  // Fetch clients for invoice data
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  
  // Fetch settings for business details
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });
  
  // Delete invoice mutation
  const deleteInvoice = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice deleted",
        description: "The invoice has been deleted successfully.",
      });
      setSelectedInvoiceId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the invoice. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  const handleExportPdf = async (invoice: Invoice) => {
    const client = clients.find(c => c.id === invoice.clientId);
    
    if (!client || !settings) {
      toast({
        title: "Error",
        description: "Failed to export invoice. Missing client or business details.",
        variant: "destructive",
      });
      return;
    }
    
    // Fetch invoice data
    try {
      // Get the full invoice data
      const invoiceRes = await fetch(`/api/invoices/${invoice.id}`);
      const invoiceData = await invoiceRes.json();
      
      // Get all time entries and filter by those with matching invoiceId
      const entriesRes = await fetch(`/api/time-entries`);
      const allTimeEntries = await entriesRes.json();
      let invoiceEntries = allTimeEntries.filter((entry: any) => entry.invoiceId === invoice.id);
      
      console.log(`Found ${invoiceEntries.length} time entries for invoice ${invoice.id}`);
      
      // Enrich entries with project and client data for currency display
      const enrichedEntries = await Promise.all(invoiceEntries.map(async (entry: any) => {
        // Make sure each entry has project data
        if (!entry.project && entry.projectId) {
          try {
            const projectRes = await fetch(`/api/projects/${entry.projectId}`);
            if (projectRes.ok) {
              entry.project = await projectRes.json();
            }
          } catch (err) {
            console.error("Failed to fetch project for entry:", err);
          }
        }
        
        // Ensure client data is attached for currency formatting
        if (!entry.client) {
          entry.client = client;
        }
        
        return entry;
      }));
      
      // Parse additional items from notes if they exist
      let notes = invoiceData.notes || "";
      let additionalItems = [];
      
      if (notes && notes.includes("ADDITIONAL_ITEMS:")) {
        const parts = notes.split("ADDITIONAL_ITEMS:");
        notes = parts[0].trim();
        try {
          additionalItems = JSON.parse(parts[1].trim());
          console.log("Found additional items in invoice notes:", additionalItems);
        } catch (e) {
          console.error("Failed to parse additional items:", e);
        }
      }
      
      // Determine which currency to use (client's currency takes precedence)
      const usedCurrency = client.currency || settings.defaultCurrency || 'USD';
      console.log("Using currency for PDF export:", usedCurrency);
      
      // Create report data
      const reportData = {
        timeEntries: enrichedEntries,
        additionalItems,
        clientCurrency: usedCurrency,
        totalHours: enrichedEntries.reduce((sum: number, entry: any) => sum + parseFloat(entry.duration || 0), 0),
        totalAmount: Number(invoiceData.total),
        timeFormat: settings.defaultTimeFormat || 'decimal'
      };
      
      // Generate PDF
      const filename = `invoice-${invoice.invoiceNumber.replace('INV-', '')}.pdf`;
      
      generatePdf({
        filename,
        invoice: invoiceData,
        client,
        settings,
        reportData, // Include enhanced report data with time entries
        type: "invoice",
        showDueDate: settings.showDueDate === null ? undefined : !!settings.showDueDate
      });
      
      toast({
        title: "Invoice exported",
        description: `Your invoice has been exported as ${filename}`,
      });
    } catch (error) {
      console.error("Error exporting invoice:", error);
      toast({
        title: "Error",
        description: "Failed to export invoice. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const columns = [
    {
      header: "Invoice #",
      accessorKey: "invoiceNumber",
      className: "font-medium",
    },
    {
      header: "Client",
      accessorKey: (row: Invoice) => {
        const client = clients.find(c => c.id === row.clientId);
        return client ? client.name : "Unknown Client";
      },
    },
    {
      header: "Issue Date",
      accessorKey: (row: Invoice) => format(new Date(row.issueDate), "MMM d, yyyy"),
    },
    {
      header: "Due Date",
      accessorKey: (row: Invoice) => format(new Date(row.dueDate), "MMM d, yyyy"),
    },
    {
      header: "Status",
      accessorKey: (row: Invoice) => (
        <Badge 
          variant={
            row.status === "paid" ? "default" : 
            row.status === "sent" ? "outline" : 
            "secondary"
          }
        >
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </Badge>
      ),
    },
    {
      header: "Amount",
      accessorKey: (row: Invoice) => {
        // Get client's currency
        const client = clients.find(c => c.id === row.clientId);
        const currency = client?.currency || 'USD';
        
        // Get the currency symbol
        const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'RSD' ? 'RSD' : '$';
        
        // Format the amount with the correct currency symbol
        return `${symbol}${Number(row.total).toFixed(2)}`;
      },
      className: "text-right",
    },
    {
      header: "Actions",
      accessorKey: (row: Invoice) => (
        <div className="flex space-x-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => handleExportPdf(row)}
            className="h-8 w-8"
            title="Export PDF"
          >
            <File className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              // When clicking edit, fetch the full invoice data first
              fetch(`/api/invoices/${row.id}`)
                .then(res => res.json())
                .then(fullInvoiceData => {
                  console.log("Fetched full invoice data for editing:", fullInvoiceData);
                  setEditingInvoice(fullInvoiceData);
                  setIsEditDialogOpen(true);
                })
                .catch(err => {
                  console.error("Error fetching invoice data:", err);
                  toast({
                    title: "Error",
                    description: "Failed to load invoice data for editing.",
                    variant: "destructive",
                  });
                });
            }}
            className="h-8 w-8"
            title="Edit Invoice"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSelectedInvoiceId(row.id)}
            className="h-8 w-8 text-destructive hover:text-destructive/80"
            title="Delete Invoice"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
        <p className="text-gray-500 mt-1">
          Manage your client invoices and track payments.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            View all your created invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={invoices}
            columns={columns}
            isLoading={isLoading}
            emptyState={
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">No invoices</h3>
                <p className="mt-1 text-sm text-gray-500">
                  You haven't created any invoices yet. Generate a report first and create an invoice from there.
                </p>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={selectedInvoiceId !== null} onOpenChange={(open) => !open && setSelectedInvoiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected invoice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedInvoiceId && deleteInvoice.mutate(selectedInvoiceId)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Edit Invoice Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
            <DialogDescription>
              Make changes to the invoice details, due date, or additional items.
            </DialogDescription>
          </DialogHeader>
          
          {editingInvoice && (
            <InvoiceEditor 
              invoice={editingInvoice}
              clients={clients}
              settings={settings}
              onClose={() => {
                setIsEditDialogOpen(false);
                setEditingInvoice(null);
              }}
              onSave={() => {
                setIsEditDialogOpen(false);
                setEditingInvoice(null);
                // Refresh invoice data
                queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
