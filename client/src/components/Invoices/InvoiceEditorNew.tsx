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
import { generatePdf } from "@/lib/pdf-generator-fixed-new";

interface InvoiceEditorProps {
  invoice: Invoice | null;
  onClose: () => void;
  onSave: () => void;
}

export default function InvoiceEditorNew({ invoice, onClose, onSave }: InvoiceEditorProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showDueDate, setShowDueDate] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [additionalItems, setAdditionalItems] = useState<any[]>([]);

  // Get data via React Query for better caching and performance
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    staleTime: 60000, // 1 minute
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    staleTime: 60000, // 1 minute
  });

  const { data: timeEntries = [] } = useQuery<any[]>({
    queryKey: ["/api/time-entries"],
    staleTime: 30000, // 30 seconds
  });

  // Get the client for this invoice
  const client = clients.find(c => c && invoice && c.id === invoice.clientId);

  // Setup the invoice data when it's available
  useEffect(() => {
    if (invoice && client && timeEntries.length > 0) {
      setupInvoiceData();
    }
  }, [invoice, client, timeEntries, settings]);

  // Prepare invoice data directly without additional API calls
  const setupInvoiceData = () => {
    if (!invoice || !client) return;
    
    try {
      setIsLoading(true);
      
      // Set basic invoice fields
      setDueDate(invoice.dueDate || "");
      setShowDueDate(settings?.showDueDate || false);
      
      // Extract notes and additional items
      let basicNotes = invoice.notes || "";
      let items: any[] = [];
      
      if (basicNotes && basicNotes.includes("ADDITIONAL_ITEMS:")) {
        // Extract the notes part
        basicNotes = basicNotes.split("ADDITIONAL_ITEMS:")[0].trim();
        
        // Try to parse additional items
        try {
          const itemsText = invoice.notes.split("ADDITIONAL_ITEMS:")[1];
          if (itemsText) {
            const cleanItemsText = itemsText.includes("\n\n") 
              ? itemsText.split("\n\n")[0].trim()
              : itemsText.trim();
              
            items = JSON.parse(cleanItemsText);
          }
        } catch (e) {
          console.warn("Failed to parse additional items:", e);
          items = [];
        }
      }
      
      setInvoiceNotes(basicNotes);
      setAdditionalItems(items);
      
      // Extract time entries for this invoice
      const invoiceEntries = timeEntries.filter(
        (entry: any) => entry.invoiceId === invoice.id
      );
      
      console.log(`Found ${invoiceEntries.length} time entries for invoice ${invoice.id}`);
      
      if (invoiceEntries.length === 0) {
        setIsLoading(false);
        setReportData(null);
        return;
      }
      
      // Process any edited entry information from the notes
      let finalEntries = [...invoiceEntries];
      if (invoice.notes && invoice.notes.includes("EDITED_ENTRIES:")) {
        try {
          const editedText = invoice.notes.split("EDITED_ENTRIES:")[1];
          if (editedText) {
            const cleanEditedText = editedText.includes("\n\n") 
              ? editedText.split("\n\n")[0].trim()
              : editedText.trim();
              
            const editedEntries = JSON.parse(cleanEditedText);
            
            if (Array.isArray(editedEntries) && editedEntries.length > 0) {
              // Create lookup map for efficient access
              const editedMap = new Map();
              editedEntries.forEach((edited: any) => {
                editedMap.set(edited.id, edited);
              });
              
              // Apply edited values
              finalEntries = invoiceEntries.map((entry: any) => {
                const editedVersion = editedMap.get(entry.id);
                if (editedVersion) {
                  return {
                    ...entry,
                    duration: editedVersion.duration,
                    amount: editedVersion.amount,
                    editedDuration: editedVersion.duration,
                    editedAmount: editedVersion.amount,
                    wasEdited: true
                  };
                }
                return entry;
              });
            }
          }
        } catch (e) {
          console.warn("Failed to parse edited entries:", e);
        }
      }
      
      // Group entries by week
      const weekMap = new Map();
      finalEntries.forEach((entry: any) => {
        const weekLabel = entry.weekLabel || "Week";
        const weekNumber = entry.weekNumber || 1;
        
        if (!weekMap.has(weekLabel)) {
          weekMap.set(weekLabel, {
            weekNumber,
            weekLabel,
            entries: [],
            totalAmount: 0
          });
        }
        
        const weekData = weekMap.get(weekLabel);
        
        // Calculate amount if not already set
        let amount = entry.amount;
        if (!amount && entry.project && entry.duration) {
          const rate = parseFloat(entry.project.hourlyRate || "0");
          const duration = parseFloat(entry.duration || "0");
          amount = (rate * duration).toFixed(2);
        }
        
        const finalEntry = {
          ...entry,
          amount: amount || "0"
        };
        
        weekData.entries.push(finalEntry);
        weekData.totalAmount += parseFloat(finalEntry.amount);
      });
      
      // Convert weeks to sorted array
      const weeklyData = Array.from(weekMap.values())
        .sort((a, b) => a.weekNumber - b.weekNumber);
      
      // Calculate total hours
      const totalHours = finalEntries.reduce(
        (sum, entry) => sum + parseFloat(entry.duration || "0"), 
        0
      );
      
      // Set report data
      setReportData({
        timeEntries: finalEntries,
        weeklyData: weeklyData.length > 0 ? weeklyData : [{
          weekNumber: 1,
          weekLabel: "All Entries",
          entries: finalEntries,
          totalAmount: finalEntries.reduce(
            (sum, entry) => sum + parseFloat(entry.amount || "0"), 
            0
          )
        }],
        additionalItems: items,
        totalHours,
        totalAmount: Number(invoice.total || 0),
        timeFormat: settings?.defaultTimeFormat || "decimal"
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error preparing invoice data:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to prepare invoice data. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const handleSaveInvoice = async () => {
    if (!invoice || !client) return;
    
    try {
      setIsLoading(true);
      
      // Prepare invoice data for update
      const invoiceData = {
        status: invoice.status,
        notes: additionalItems.length > 0 ? 
          `${invoiceNotes}\n\nADDITIONAL_ITEMS:${JSON.stringify(additionalItems)}` : 
          invoiceNotes,
        dueDate,
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
      console.log("Using currency for PDF export:", clientCurrency);
      
      // Create report data with client currency
      const exportData = {
        ...reportData,
        clientCurrency
      };
      
      generatePdf({
        filename,
        type: "invoice",
        invoice,
        client,
        settings,
        reportData: exportData,
        showDueDate
      });
      
      setIsLoading(false);
      toast({
        title: "Invoice exported",
        description: `The invoice has been exported to ${filename}.`,
      });
    } catch (error) {
      console.error("Error exporting invoice:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to export the invoice. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Generate simple notes input handler
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInvoiceNotes(e.target.value);
  };
  
  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-2xl font-bold">
            {invoice ? `Edit Invoice ${invoice.invoiceNumber}` : "New Invoice"}
          </h2>
          <Button variant="ghost" onClick={onClose}>✕</Button>
        </div>
        
        <div className="flex-1 overflow-auto grid md:grid-cols-2 gap-4 p-4">
          <div className="space-y-4 overflow-auto pb-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Invoice Details</h3>
                  
                  <div className="grid gap-2">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Client</label>
                      <div className="p-2 border rounded bg-muted">
                        {client?.name || "No client selected"}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-1 block">Invoice Number</label>
                      <div className="p-2 border rounded bg-muted">
                        {invoice?.invoiceNumber || "N/A"}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-1 block">Issue Date</label>
                      <div className="p-2 border rounded bg-muted">
                        {invoice?.issueDate || "N/A"}
                      </div>
                    </div>
                    
                    {showDueDate && (
                      <div>
                        <label className="text-sm font-medium mb-1 block">Due Date</label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full p-2 border rounded"
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Notes</h3>
                  <textarea
                    value={invoiceNotes}
                    onChange={handleNotesChange}
                    rows={4}
                    className="w-full p-2 border rounded"
                    placeholder="Add notes to the invoice..."
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="relative overflow-hidden flex flex-col h-full">
            {isLoading && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            )}
            
            <div className="flex-1 overflow-auto">
              {reportData ? (
                <InvoicePreview
                  client={client!}
                  settings={settings!}
                  reportData={reportData}
                  invoiceNumber={invoice?.invoiceNumber || ""}
                  issueDate={invoice?.issueDate || ""}
                  dueDate={dueDate}
                  showDueDate={showDueDate}
                  additionalItems={additionalItems}
                  setAdditionalItems={setAdditionalItems}
                  isEditing={true}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">
                    {isLoading ? "Loading invoice data..." : "No invoice data available"}
                  </p>
                </div>
              )}
            </div>
            
            <div className="border-t p-4 flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleExportPdf} disabled={isLoading || !reportData}>
                Export PDF
              </Button>
              <Button onClick={handleSaveInvoice} disabled={isLoading}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}