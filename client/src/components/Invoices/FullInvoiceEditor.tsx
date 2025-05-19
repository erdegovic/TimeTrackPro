import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Client, Settings, Invoice } from "@shared/schema";
import InvoicePreview from "./InvoicePreview";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/pdf-generator-fixed-new";

interface FullInvoiceEditorProps {
  invoice: Invoice;
  onClose: () => void;
  onSave: () => void;
}

// This is a complete rewrite of the invoice editor to match the functionality
// of the invoice generator in the reports tab
export default function FullInvoiceEditor({ invoice, onClose, onSave }: FullInvoiceEditorProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showDueDate, setShowDueDate] = useState(true);
  const [additionalItems, setAdditionalItems] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);

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

  useEffect(() => {
    if (invoice?.id && clients.length > 0) {
      // Load invoice data directly
      loadInvoiceData();
    }
  }, [invoice?.id, clients.length]);

  const loadInvoiceData = async () => {
    if (!invoice) return;
    
    try {
      setIsLoading(true);
      
      // Set basic invoice fields
      setDueDate(invoice.dueDate || "");
      setShowDueDate(settings?.showDueDate || false);
      
      // Parse notes and additional items from the invoice
      let basicNotes = invoice.notes || "";
      let additionalItemsList: any[] = [];
      
      if (invoice.notes?.includes("ADDITIONAL_ITEMS:")) {
        // Extract just the notes part
        basicNotes = invoice.notes.split("ADDITIONAL_ITEMS:")[0].trim();
        
        // Try to parse additional items
        try {
          const itemsText = invoice.notes.split("ADDITIONAL_ITEMS:")[1];
          if (itemsText) {
            const cleanItemsText = itemsText.includes("\n\n") 
              ? itemsText.split("\n\n")[0].trim()
              : itemsText.trim();
              
            additionalItemsList = JSON.parse(cleanItemsText);
          }
        } catch (e) {
          console.error("Failed to parse additional items:", e);
          additionalItemsList = [];
        }
      }
      
      setInvoiceNotes(basicNotes);
      setAdditionalItems(additionalItemsList);
      
      // Fetch time entries - one single API call
      const timeEntriesRes = await fetch("/api/time-entries");
      const allTimeEntries = await timeEntriesRes.json();
      
      // Filter for just this invoice
      const invoiceEntries = allTimeEntries.filter((entry: any) => 
        entry.invoiceId === invoice.id
      );
      
      if (invoiceEntries.length === 0) {
        setIsLoading(false);
        setReportData({
          timeEntries: [],
          weeklyData: [],
          additionalItems: additionalItemsList,
          totalHours: 0,
          totalAmount: 0,
          timeFormat: settings?.defaultTimeFormat || "decimal"
        });
        return;
      }
      
      // Fetch all projects in a single call
      const projectsRes = await fetch("/api/projects");
      const allProjects = await projectsRes.json();
      
      // Create a map for easier lookups
      const projectsMap = new Map();
      allProjects.forEach((project: any) => {
        projectsMap.set(project.id, project);
      });
      
      // Process and enhance time entries with project data
      const enhancedEntries = invoiceEntries.map((entry: any) => {
        // If entry doesn't have project data, add it
        if (!entry.project && entry.projectId) {
          entry.project = projectsMap.get(entry.projectId);
        }
        
        // Calculate amount if not present
        if (!entry.amount && entry.project && entry.duration) {
          const hourlyRate = parseFloat(entry.project.hourlyRate || "0");
          const duration = parseFloat(entry.duration || "0");
          entry.amount = (hourlyRate * duration).toFixed(2);
        }
        
        return entry;
      });
      
      // Handle edited entries if present in the invoice notes
      let finalEntries = enhancedEntries;
      if (invoice.notes?.includes("EDITED_ENTRIES:")) {
        try {
          const editedText = invoice.notes.split("EDITED_ENTRIES:")[1];
          if (editedText) {
            const cleanEditedText = editedText.includes("\n\n") 
              ? editedText.split("\n\n")[0].trim()
              : editedText.trim();
              
            const editedEntries = JSON.parse(cleanEditedText);
            
            if (Array.isArray(editedEntries) && editedEntries.length > 0) {
              // Create a map for quick lookups
              const editedMap = new Map();
              editedEntries.forEach((edited: any) => {
                editedMap.set(edited.id, edited);
              });
              
              // Apply edited values
              finalEntries = enhancedEntries.map((entry: any) => {
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
          console.error("Failed to parse edited entries:", e);
        }
      }
      
      // Group entries by week for the report
      const weekMap = new Map();
      finalEntries.forEach((entry: any) => {
        const weekLabel = entry.weekLabel || "Week 1";
        const weekNumber = entry.weekNumber || 1;
        
        if (!weekMap.has(weekLabel)) {
          weekMap.set(weekLabel, {
            weekNumber,
            weekLabel,
            entries: [],
            totalAmount: 0
          });
        }
        
        const week = weekMap.get(weekLabel);
        week.entries.push(entry);
        week.totalAmount += parseFloat(entry.amount || "0");
      });
      
      // Convert to array and sort by week number
      const weeklyData = Array.from(weekMap.values())
        .sort((a: any, b: any) => a.weekNumber - b.weekNumber);
      
      // Calculate total hours
      const totalHours = finalEntries.reduce(
        (sum: number, entry: any) => sum + parseFloat(entry.duration || "0"), 
        0
      );
      
      // Set the report data for the preview
      setReportData({
        timeEntries: finalEntries,
        weeklyData: weeklyData.length > 0 ? weeklyData : [{
          weekNumber: 1,
          weekLabel: "All Entries",
          entries: finalEntries,
          totalAmount: finalEntries.reduce(
            (sum: number, entry: any) => sum + parseFloat(entry.amount || "0"), 
            0
          )
        }],
        additionalItems: additionalItemsList,
        totalHours,
        totalAmount: Number(invoice.total || 0),
        timeFormat: settings?.defaultTimeFormat || "decimal"
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading invoice data:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to load invoice data. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSaveInvoice = async () => {
    if (!invoice || !client || !reportData) return;
    
    try {
      setIsLoading(true);
      
      // Collect all edited entries from the preview
      const previewElement = document.querySelector('.invoice-preview');
      let editedTimeEntries: any[] = [];
      
      if (previewElement) {
        // Get all elements with data-entry-id
        const entryElements = previewElement.querySelectorAll('[data-entry-id]');
        
        // Extract edited values
        entryElements.forEach(element => {
          const entryId = element.getAttribute('data-entry-id');
          const editedDuration = element.getAttribute('data-edited-duration');
          const editedAmount = element.getAttribute('data-edited-amount');
          
          if (entryId && (editedDuration || editedAmount)) {
            // Find the original entry
            const originalEntry = reportData.timeEntries.find((entry: any) => entry.id === Number(entryId));
            
            if (originalEntry) {
              editedTimeEntries.push({
                id: Number(entryId),
                duration: editedDuration || originalEntry.duration,
                amount: editedAmount || originalEntry.amount,
                // Keep key info for reference
                description: originalEntry.description,
                projectId: originalEntry.projectId,
                date: originalEntry.date,
                weekNumber: originalEntry.weekNumber,
                weekLabel: originalEntry.weekLabel,
                // Include reference to project for rate calculations
                project: {
                  id: originalEntry.project?.id,
                  name: originalEntry.project?.name,
                  hourlyRate: originalEntry.project?.hourlyRate
                }
              });
            }
          }
        });
      }
      
      // Prepare invoice update data
      const updateData = {
        status: invoice.status,
        dueDate,
        // Store notes, additional items, and edited entries
        notes: `${invoiceNotes}

ADDITIONAL_ITEMS:${JSON.stringify(additionalItems)}

EDITED_ENTRIES:${JSON.stringify(editedTimeEntries)}`
      };
      
      // Update the invoice
      await apiRequest("PUT", `/api/invoices/${invoice.id}`, updateData);
      
      // Refresh invoices data
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      
      setIsLoading(false);
      onSave();
      
      toast({
        title: "Invoice updated",
        description: "The invoice has been updated successfully."
      });
    } catch (error) {
      console.error("Error saving invoice:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to save invoice. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleExportPdf = () => {
    if (!invoice || !client || !settings || !reportData) return;
    
    try {
      setIsLoading(true);
      
      // Get filename based on invoice number
      const filename = `invoice-${invoice.invoiceNumber.replace('INV-', '')}.pdf`;
      
      // Use client currency or default
      const clientCurrency = client.currency || settings.defaultCurrency || 'USD';
      
      // Add currency to report data for the PDF generator
      const exportData = {
        ...reportData,
        clientCurrency
      };
      
      // Generate the PDF
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
        title: "PDF Exported",
        description: `Invoice ${invoice.invoiceNumber} has been exported to PDF.`
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to export PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle notes input change
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInvoiceNotes(e.target.value);
  };

  // Toggle show due date
  const handleToggleShowDueDate = () => {
    setShowDueDate(!showDueDate);
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-4 overflow-auto pb-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <div className="p-2 border rounded bg-muted">
              {client?.name || "No client selected"}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Invoice Number</Label>
            <div className="p-2 border rounded bg-muted">
              {invoice?.invoiceNumber || "N/A"}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="issueDate">Issue Date</Label>
            <div className="p-2 border rounded bg-muted">
              {invoice?.issueDate || "N/A"}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="showDueDate" 
                checked={showDueDate} 
                onCheckedChange={handleToggleShowDueDate} 
              />
              <Label htmlFor="showDueDate">Show Due Date</Label>
            </div>
            
            {showDueDate && (
              <div className="space-y-1">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full"
                />
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={invoiceNotes}
              onChange={handleNotesChange}
              placeholder="Add invoice notes here..."
              rows={4}
              className="w-full"
            />
          </div>
        </div>
      </div>
      
      <div className="relative space-y-4 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        )}
        
        <div className="border rounded-md overflow-auto max-h-[70vh]">
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
              notes={invoiceNotes}
              setNotes={setInvoiceNotes}
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">
                {isLoading ? "Loading invoice data..." : "No invoice data available"}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleExportPdf} disabled={isLoading || !reportData}>
            Export PDF
          </Button>
          <Button onClick={handleSaveInvoice} disabled={isLoading || !reportData}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}