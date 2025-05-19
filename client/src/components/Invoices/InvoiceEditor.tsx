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
import { generatePdf } from "@/lib/pdf-simple";

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
      console.log("Loading invoice data for:", invoice.id);
      fetchInvoiceData();
    }
  }, [invoice?.id]);
  
  // Fetch the invoice's time entries and related data
  const fetchInvoiceData = async () => {
    if (!invoice || !invoice.id) return;
    
    try {
      setIsLoading(true);
      console.log("Fetching data for invoice ID:", invoice.id);
      
      // Fetch the full invoice data
      const res = await fetch(`/api/invoices/${invoice.id}`);
      const invoiceData = await res.json();
      console.log("Loaded invoice data:", invoiceData);
      
      // Set due date from invoice data
      setDueDate(invoiceData.dueDate);
      
      // Check if settings have showDueDate preference
      if (settings) {
        setShowDueDate(settings.showDueDate !== null ? settings.showDueDate : true);
      }
      
      // Parse additional items from notes if they exist
      let notes = invoiceData.notes || "";
      let items: any[] = [];
      
      if (notes && notes.includes("ADDITIONAL_ITEMS:")) {
        const parts = notes.split("ADDITIONAL_ITEMS:");
        notes = parts[0].trim();
        try {
          items = JSON.parse(parts[1].trim());
          console.log("Parsed additional items:", items);
        } catch (e) {
          console.error("Failed to parse additional items:", e);
        }
      }
      
      setInvoiceNotes(notes);
      setAdditionalItems(items || []);
      
      // Get all time entries and filter by those with matching invoiceId
      const entriesRes = await fetch(`/api/time-entries`);
      const allTimeEntries = await entriesRes.json();
      let timeEntries = allTimeEntries.filter((entry: any) => entry.invoiceId === invoice.id);
      
      console.log("Found time entries for invoice:", timeEntries.length);
      
      if (timeEntries.length === 0) {
        toast({
          title: "Warning",
          description: "No time entries found for this invoice.",
        });
      }
      
      // Enrich time entries with client and project data
      const enrichedEntries = await Promise.all(timeEntries.map(async (entry: any) => {
        if (!entry.project && entry.projectId) {
          try {
            // Get project data
            const projectRes = await fetch(`/api/projects/${entry.projectId}`);
            if (projectRes.ok) {
              entry.project = await projectRes.json();
            }
          } catch (err) {
            console.error("Failed to fetch project for entry:", err);
          }
        }
        
        // Assign the client data
        if (!entry.client && client) {
          entry.client = client;
        }
        
        return entry;
      }));
      
      // Format the report data for the preview
      setReportData({
        timeEntries: enrichedEntries,
        additionalItems: items,
        totalHours: enrichedEntries.reduce((sum: number, entry: any) => sum + parseFloat(entry.duration || 0), 0),
        totalAmount: Number(invoiceData.total),
        timeFormat: settings?.defaultTimeFormat || 'decimal',
        clientCurrency: client?.currency || settings?.defaultCurrency || 'USD'
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
      setIsLoading(true);
      // Generate PDF with current data
      const filename = `invoice-${invoice.invoiceNumber.replace('INV-', '')}.pdf`;
      
      // Make sure client has currency properly set
      const clientCurrency = client.currency || settings.defaultCurrency || 'USD';
      console.log("Using client currency for PDF export:", clientCurrency);
      
      // Prepare report data with currency information to ensure proper formatting
      const enrichedTimeEntries = reportData.timeEntries.map((entry: any) => {
        // Ensure each entry has client info for currency
        if (!entry.client && client) {
          entry.client = client;
        }
        return entry;
      });
      
      // Create the enhanced report data with weeklyData to avoid PDF generation errors
      const enhancedReportData = {
        ...reportData,
        timeEntries: enrichedTimeEntries,
        additionalItems: additionalItems,
        clientCurrency: clientCurrency,
        // Explicitly add weeklyData structure for safety
        weeklyData: [{
          weekLabel: 'All Entries',
          entries: enrichedTimeEntries,
          totalDuration: enrichedTimeEntries.reduce((sum: number, entry: any) => 
            sum + parseFloat(String(entry.duration || 0)), 0),
          totalAmount: Number(invoice.total || 0)
        }]
      };
      
      generatePdf({
        filename,
        type: "invoice",
        invoice,
        client,
        settings,
        reportData: enhancedReportData,
        showDueDate
      });
      
      setIsLoading(false);
      toast({
        title: "Invoice exported",
        description: `Your invoice has been exported as ${filename}`,
      });
    } catch (error) {
      console.error("Error exporting invoice:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to export invoice. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  if (!invoice || !client || !settings) {
    return <div className="p-8 flex justify-center items-center">
      <div className="animate-pulse">Loading invoice data...</div>
    </div>;
  }
  
  return (
    <div className="space-y-6 p-6">
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
      
      {reportData ? (
        <Card>
          <CardContent className="p-6">
            <InvoicePreview 
              clientId={client.id}
              reportData={reportData}
              additionalItems={additionalItems}
              setAdditionalItems={setAdditionalItems}
              notes={invoiceNotes}
              setNotes={setInvoiceNotes}
              showDueDate={showDueDate}
              setShowDueDate={setShowDueDate}
              dueDate={dueDate}
              setDueDate={setDueDate}
              invoiceNumber={invoice.invoiceNumber}
              issueDate={invoice.issueDate}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-center p-10">
          <div className="animate-pulse">Loading invoice data...</div>
        </div>
      )}
    </div>
  );
}