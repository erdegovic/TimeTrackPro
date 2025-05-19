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
        setShowDueDate(settings.showDueDate || true);
      }
      
      // Parse additional items from notes if they exist
      let notes = invoiceData.notes || "";
      let items: any[] = [];
      
      if (notes && notes.includes("ADDITIONAL_ITEMS:")) {
        const parts = notes.split("ADDITIONAL_ITEMS:");
        notes = parts[0].trim();
        
        try {
          // Handle different possible formats of the additional items in the notes
          const additionalItemsText = parts[1].trim();
          
          // Try parsing the whole additional items section
          try {
            items = JSON.parse(additionalItemsText);
            console.log("Successfully parsed additional items:", items);
          } catch (parseError) {
            // If that fails, try to extract just the JSON part
            console.log("Initial additional items parse failed, trying to extract JSON section");
            
            if (additionalItemsText.includes("\n\n")) {
              // If there are multiple sections, take just the first one
              const itemsClean = additionalItemsText.split("\n\n")[0];
              items = JSON.parse(itemsClean);
              console.log("Parsed additional items from first section:", items);
            } else {
              // Last attempt - find the closing bracket of the JSON array
              const lastBracketIndex = additionalItemsText.lastIndexOf("]");
              if (lastBracketIndex > 0) {
                const itemsClean = additionalItemsText.substring(0, lastBracketIndex + 1);
                items = JSON.parse(itemsClean);
                console.log("Parsed additional items by finding closing bracket:", items);
              } else {
                throw new Error("Could not find valid JSON data for additional items");
              }
            }
          }
        } catch (e) {
          console.error("Failed to parse additional items:", e);
          // Use empty array as fallback
          items = [];
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
        if (!entry.project) {
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
        return entry;
      }));
      
      // Check for edited entries in the stored notes
      let editedEntries = enrichedEntries;
      if (notes && notes.includes("EDITED_ENTRIES:")) {
        try {
          // Extract the edited entries section
          const editedEntriesParts = notes.split("EDITED_ENTRIES:");
          const editedEntriesJson = editedEntriesParts[1].trim();
          
          // Handle different possible formats in the notes
          let parsedEditedEntries;
          try {
            // Try parsing the whole thing first
            parsedEditedEntries = JSON.parse(editedEntriesJson);
            console.log("Successfully parsed edited entries JSON");
          } catch (parseError) {
            // If that fails, try to extract just the JSON part
            console.log("Initial parse failed, trying to extract JSON section");
            if (editedEntriesJson.includes("\n\n")) {
              // If there are multiple sections, take just the first one
              const editedEntriesClean = editedEntriesJson.split("\n\n")[0];
              parsedEditedEntries = JSON.parse(editedEntriesClean);
            } else {
              // Last attempt - find the closing bracket of the JSON array
              const lastBracketIndex = editedEntriesJson.lastIndexOf("]");
              if (lastBracketIndex > 0) {
                const editedEntriesClean = editedEntriesJson.substring(0, lastBracketIndex + 1);
                parsedEditedEntries = JSON.parse(editedEntriesClean);
              } else {
                throw new Error("Could not find valid JSON data");
              }
            }
          }
          
          if (parsedEditedEntries && Array.isArray(parsedEditedEntries)) {
            console.log("Found edited entries data:", parsedEditedEntries.length);
            
            // Create a map for quick lookup
            const editedEntriesMap = new Map();
            parsedEditedEntries.forEach((edited: any) => {
              editedEntriesMap.set(edited.id, edited);
            });
            
            // Apply edited values to our entries
            editedEntries = enrichedEntries.map((entry: any) => {
              const editedVersion = editedEntriesMap.get(entry.id);
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
          } else {
            console.warn("Parsed data is not an array or is empty");
          }
        } catch (error) {
          console.error("Error parsing edited entries data:", error);
          // Fall back to using the original entries without edits
          console.log("Using non-edited entries as fallback");
        }
      }
      
      // Calculate weekly data from the entries
      // Group entries by week
      const entriesByWeek = editedEntries.reduce((acc: any, entry: any) => {
        const weekLabel = entry.weekLabel || 'Unknown Week';
        const weekNumber = entry.weekNumber || 0;
        
        if (!acc[weekLabel]) {
          acc[weekLabel] = {
            weekNumber,
            weekLabel,
            entries: [],
            totalAmount: 0
          };
        }
        
        acc[weekLabel].entries.push(entry);
        acc[weekLabel].totalAmount += parseFloat(entry.amount || 0);
        
        return acc;
      }, {});
      
      // Convert to array and sort by week number
      const weeklyData = Object.values(entriesByWeek).sort((a: any, b: any) => a.weekNumber - b.weekNumber);
      
      // Make sure weekly data is correctly constructed
      if (!weeklyData || weeklyData.length === 0) {
        console.log("No weekly data could be calculated, using a default structure");
        
        // If no weekly data, create a simple structure with all entries in one week
        const singleWeek = {
          weekNumber: 1, 
          weekLabel: 'All Items',
          entries: editedEntries,
          totalAmount: editedEntries.reduce((sum: number, entry: any) => 
            sum + parseFloat(String(entry.amount || '0')), 0)
        };
        
        // Format the report data with this simple structure
        setReportData({
          timeEntries: editedEntries,
          weeklyData: [singleWeek],
          additionalItems: items,
          totalHours: editedEntries.reduce((sum: number, entry: any) => 
            sum + parseFloat(String(entry.duration || '0')), 0),
          totalAmount: Number(invoiceData.total),
          timeFormat: settings?.defaultTimeFormat || 'decimal'
        });
      } else {
        // Normal case - format the report data with the calculated weekly data
        console.log("Using calculated weekly data:", weeklyData.length, "weeks");
        setReportData({
          timeEntries: editedEntries,
          weeklyData,
          additionalItems: items,
          totalHours: editedEntries.reduce((sum: number, entry: any) => 
            sum + parseFloat(String(entry.duration || '0')), 0),
          totalAmount: Number(invoiceData.total),
          timeFormat: settings?.defaultTimeFormat || 'decimal'
        });
      }
      
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
      
      // We need to get all edited values from the InvoicePreview component
      // Get the preview element 
      const previewElement = document.querySelector('.invoice-preview');
      let editedTimeEntries = [];
      
      // Try to find any edited time entries from the preview component
      if (previewElement) {
        // Find all time entry rows with data attributes
        const entryElements = previewElement.querySelectorAll('[data-entry-id]');
        console.log(`Found ${entryElements.length} edited entries in the preview`);
        
        // Build a map of edited values
        const editedEntriesMap = new Map();
        entryElements.forEach(element => {
          const entryId = element.getAttribute('data-entry-id');
          const editedDuration = element.getAttribute('data-edited-duration');
          const editedAmount = element.getAttribute('data-edited-amount');
          
          if (entryId && (editedDuration || editedAmount)) {
            editedEntriesMap.set(Number(entryId), {
              id: Number(entryId),
              duration: editedDuration ? parseFloat(editedDuration) : undefined,
              amount: editedAmount ? parseFloat(editedAmount) : undefined
            });
          }
        });
        
        // Apply edits to the time entries
        editedTimeEntries = reportData.timeEntries.map((entry: any) => {
          const edits = editedEntriesMap.get(entry.id);
          
          // Create a new entry with edits applied
          return {
            ...entry,
            // Use edited duration if available, otherwise use original
            duration: edits?.duration !== undefined ? edits.duration : entry.duration,
            // Explicitly flag as edited and store the edited value
            editedDuration: edits?.duration !== undefined ? edits.duration : entry.duration,
            // Use edited amount if available, otherwise use original
            amount: edits?.amount !== undefined ? edits.amount : entry.amount,
            // Explicitly flag as edited and store the edited value
            editedAmount: edits?.amount !== undefined ? edits.amount : entry.amount,
            // Ensure client info is available
            client: entry.client || client
          };
        });
        
        console.log("Prepared edited entries for PDF:", editedTimeEntries.length);
      } else {
        // If we can't find the preview element, use the original entries
        console.log("Could not find invoice preview element, using original entries");
        editedTimeEntries = reportData.timeEntries.map((entry: any) => ({
          ...entry,
          client: entry.client || client
        }));
      }
      
      // Create the enhanced report data with all edits included
      const enhancedReportData = {
        ...reportData,
        timeEntries: editedTimeEntries,
        additionalItems: additionalItems,
        clientCurrency: clientCurrency
      };
      
      // CRITICAL FIX: Add a direct observer to get updated entries from the UI
      // Get all entries that might have been edited in the UI
      const timeEntryRows = document.querySelectorAll('[data-entry-id]');
      console.log(`Found ${timeEntryRows.length} time entries in the DOM`);
      
      // Create a map to store the edited values by entry ID
      const editedValues = new Map();
      
      // Extract information from DOM elements
      timeEntryRows.forEach(row => {
        const entryId = row.getAttribute('data-entry-id');
        const duration = row.getAttribute('data-edited-duration');
        const amount = row.getAttribute('data-edited-amount');
        
        if (entryId && (duration || amount)) {
          editedValues.set(Number(entryId), {
            id: Number(entryId),
            duration: duration ? parseFloat(duration) : undefined,
            amount: amount ? parseFloat(amount) : undefined
          });
        }
      });
      
      // Update the time entries with the edited values from the DOM
      if (editedValues.size > 0) {
        enhancedReportData.timeEntries = enhancedReportData.timeEntries.map(entry => {
          const edits = editedValues.get(entry.id);
          if (edits) {
            console.log(`Applying edits to entry ${entry.id}:`, edits);
            return {
              ...entry,
              duration: edits.duration !== undefined ? edits.duration : entry.duration,
              editedDuration: edits.duration !== undefined ? edits.duration : entry.duration,
              amount: edits.amount !== undefined ? edits.amount : entry.amount,
              editedAmount: edits.amount !== undefined ? edits.amount : entry.amount
            };
          }
          return entry;
        });
      }
      
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