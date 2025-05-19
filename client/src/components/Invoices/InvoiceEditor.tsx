import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Invoice, Client, Settings } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import InvoicePreview from "./InvoicePreview";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/pdf-generator-fixed";

interface InvoiceEditorProps {
  invoice: Invoice | null;
  onClose: () => void;
  onSave: () => void;
}

export default function InvoiceEditor({ invoice, onClose, onSave }: InvoiceEditorProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [additionalItems, setAdditionalItems] = useState<any[]>([]);
  const [showDueDate, setShowDueDate] = useState(true);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  
  // Fetch clients for invoice data
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  
  // Fetch settings for business details
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });
  
  // Get the client for this invoice
  const client = clients.find(c => c && invoice && c.id === invoice.clientId);
  
  // Fetch invoice data when an existing invoice is loaded
  useEffect(() => {
    if (invoice && invoice.id) {
      fetchInvoiceData();
    }
  }, [invoice]);
  
  // Fetch the invoice's time entries and related data
  const fetchInvoiceData = async () => {
    if (!invoice || !invoice.id) return;
    
    try {
      setIsLoading(true);
      
      // Fetch time entries for this invoice
      const res = await fetch(`/api/invoices/${invoice.id}`);
      const invoiceData = await res.json();
      
      // Parse additional items from notes if they exist
      let notes = invoiceData.notes || "";
      let items: any[] = [];
      
      if (notes.includes("ADDITIONAL_ITEMS:")) {
        const parts = notes.split("ADDITIONAL_ITEMS:");
        notes = parts[0].trim();
        try {
          items = JSON.parse(parts[1].trim());
        } catch (e) {
          console.error("Failed to parse additional items:", e);
        }
      }
      
      setInvoiceNotes(notes);
      setAdditionalItems(items || []);
      setDueDate(invoiceData.dueDate);
      
      // Need to get the time entries for this invoice to display in preview
      const timeEntries = await fetch(`/api/time-entries?invoiceId=${invoice.id}`).then(r => r.json());
      
      // Format the report data for the preview
      setReportData({
        timeEntries,
        totalHours: timeEntries.reduce((sum: number, entry: any) => sum + parseFloat(entry.duration || 0), 0),
        totalAmount: Number(invoiceData.total)
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching invoice data:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to load invoice data.",
        variant: "destructive",
      });
    }
  };
  
  const handleSaveInvoice = async () => {
    if (!invoice || !client || !settings || !reportData) return;
    
    try {
      setIsLoading(true);
      
      // Prepare invoice data for update
      const invoiceData = {
        status: invoice.status,
        notes: additionalItems.length > 0 ? 
          `${invoiceNotes}\n\nADDITIONAL_ITEMS:${JSON.stringify(additionalItems)}` : 
          invoiceNotes,
        dueDate,
        // Don't change other fields that don't need updating
      };
      
      // Update the invoice
      await apiRequest("PUT", `/api/invoices/${invoice.id}`, invoiceData);
      
      // Refresh invoice data
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      
      setIsLoading(false);
      onSave();
      
      toast({
        title: "Invoice updated",
        description: "The invoice has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating invoice:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to update the invoice. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const handleExportPdf = () => {
    if (!invoice || !client || !settings || !reportData) return;
    
    try {
      // Generate PDF with current data
      const filename = `invoice-${invoice.invoiceNumber.replace('INV-', '')}.pdf`;
      
      generatePdf({
        filename,
        type: "invoice",
        invoice,
        client,
        settings,
        reportData,
        showDueDate
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
  
  if (!invoice || !client || !settings) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Edit Invoice #{invoice.invoiceNumber}</h2>
        <div className="space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSaveInvoice} disabled={isLoading}>
            Save Changes
          </Button>
          <Button variant="secondary" onClick={handleExportPdf} disabled={isLoading}>
            Export PDF
          </Button>
        </div>
      </div>
      
      {reportData && (
        <Card>
          <CardContent className="p-6">
            <InvoicePreview 
              client={client}
              settings={settings}
              invoiceNumber={invoice.invoiceNumber}
              issueDate={invoice.issueDate}
              dueDate={dueDate}
              setDueDate={setDueDate}
              reportData={reportData}
              additionalItems={additionalItems}
              setAdditionalItems={setAdditionalItems}
              notes={invoiceNotes}
              setNotes={setInvoiceNotes}
              showDueDate={showDueDate}
              setShowDueDate={setShowDueDate}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}