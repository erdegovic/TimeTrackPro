import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/pdf-generator-fixed-new";
import { Invoice, Client, Settings } from "@shared/schema";

interface InvoiceViewEditProps {
  invoice: Invoice;
  onClose: () => void;
  onSave: () => void;
}

export default function InvoiceViewEdit({ invoice, onClose, onSave }: InvoiceViewEditProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [additionalItems, setAdditionalItems] = useState<any[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [editedEntries, setEditedEntries] = useState<Record<number, { duration: string; amount: string }>>({});

  // Fetch client data
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch settings for business details
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  // Get client for this invoice
  const client = clients.find(c => c.id === invoice.clientId);

  // Load invoice data when component mounts
  useEffect(() => {
    if (invoice && clients.length > 0 && settings) {
      loadInvoiceData();
    }
  }, [invoice?.id, clients.length, settings]);

  // Load invoice time entries and parse additional items
  const loadInvoiceData = async () => {
    try {
      setIsLoading(true);
      console.log("Loading invoice data for editing:", invoice);
      
      // Parse notes and additional items
      let invoiceNotes = invoice.notes || "";
      let additionalItemsList: any[] = [];
      let editedEntriesList: any[] = [];

      // Extract notes and additional items
      if (invoice.notes) {
        // Handle additional items if present
        if (invoice.notes.includes("ADDITIONAL_ITEMS:")) {
          const parts = invoice.notes.split("ADDITIONAL_ITEMS:");
          invoiceNotes = parts[0].trim();
          
          try {
            const itemsJson = parts[1].split("\n\nEDITED_ENTRIES:")[0].trim();
            additionalItemsList = JSON.parse(itemsJson);
          } catch (e) {
            console.error("Failed to parse additional items:", e);
          }
        }

        // Handle edited entries if present
        if (invoice.notes.includes("EDITED_ENTRIES:")) {
          try {
            const entriesJson = invoice.notes.split("EDITED_ENTRIES:")[1].trim();
            editedEntriesList = JSON.parse(entriesJson);
            
            // Create editedEntries map
            const editedEntriesMap: Record<number, { duration: string; amount: string }> = {};
            editedEntriesList.forEach((entry: any) => {
              editedEntriesMap[entry.id] = {
                duration: entry.duration,
                amount: entry.amount
              };
            });
            setEditedEntries(editedEntriesMap);
          } catch (e) {
            console.error("Failed to parse edited entries:", e);
          }
        }
      }

      setNotes(invoiceNotes);
      setAdditionalItems(additionalItemsList);

      // Fetch time entries for this invoice
      const timeEntriesRes = await fetch("/api/time-entries");
      const allTimeEntries = await timeEntriesRes.json();
      
      // Filter entries for this invoice
      const invoiceEntries = allTimeEntries.filter((entry: any) => 
        entry.invoiceId === invoice.id
      );

      if (invoiceEntries.length === 0) {
        setIsLoading(false);
        return;
      }

      // Fetch all projects
      const projectsRes = await fetch("/api/projects");
      const allProjects = await projectsRes.json();
      
      // Create a map for efficient lookups
      const projectsMap = new Map();
      allProjects.forEach((project: any) => {
        projectsMap.set(project.id, project);
      });

      // Enhance time entries with project data and calculate amounts
      const enhancedEntries = invoiceEntries.map((entry: any) => {
        // Add project data if missing
        const project = entry.project || projectsMap.get(entry.projectId);
        
        // Get hourly rate from project
        const hourlyRate = parseFloat(project?.hourlyRate || "0");
        
        // Get edited values if they exist
        const editedEntry = editedEntriesList.find((e: any) => e.id === entry.id);
        
        // Calculate or use existing values
        const duration = editedEntry ? editedEntry.duration : entry.duration;
        let amount;
        
        if (editedEntry) {
          // Use the edited amount if available
          amount = editedEntry.amount;
        } else {
          // Otherwise calculate it from duration and hourly rate
          const durationValue = parseFloat(duration || "0");
          amount = (hourlyRate * durationValue).toFixed(2);
        }
        
        return {
          ...entry,
          project,
          hourlyRate,
          duration,
          amount,
          wasEdited: !!editedEntry
        };
      });

      // Group entries by week
      const weeklyGroups = groupEntriesByWeek(enhancedEntries);
      
      // Calculate totals
      const hours = enhancedEntries.reduce(
        (sum, entry) => sum + parseFloat(entry.duration || 0), 
        0
      );
      
      const amount = enhancedEntries.reduce(
        (sum, entry) => sum + parseFloat(entry.amount || 0), 
        0
      );

      // Set state values
      setTimeEntries(enhancedEntries);
      setWeeklyData(weeklyGroups);
      setTotalHours(hours);
      setTotalAmount(amount);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading invoice data:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to load invoice data. Please try again."
      });
    }
  };

  // Group time entries by week
  const groupEntriesByWeek = (entries: any[]) => {
    if (!entries || entries.length === 0) return [];
    
    const weekMap = new Map();
    entries.forEach(entry => {
      const weekLabel = entry.weekLabel || "Week 1";
      const weekNumber = entry.weekNumber || 1;
      
      if (!weekMap.has(weekLabel)) {
        weekMap.set(weekLabel, {
          weekNumber,
          weekLabel,
          entries: [],
          totalHours: 0,
          totalAmount: 0
        });
      }
      
      const week = weekMap.get(weekLabel);
      week.entries.push(entry);
      week.totalHours += parseFloat(entry.duration || 0);
      week.totalAmount += parseFloat(entry.amount || 0);
    });
    
    // Convert to array and sort by week number
    return Array.from(weekMap.values())
      .sort((a, b) => a.weekNumber - b.weekNumber);
  };

  // Get formatted date
  const getFormattedDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMMM d, yyyy");
    } catch (e) {
      return dateString;
    }
  };

  // Handle editing time entry duration
  const handleEditDuration = (entryId: number, newDuration: string) => {
    // Parse the new duration
    const durationValue = parseFloat(newDuration) || 0;
    
    // Find the entry in our data
    const entryToUpdate = timeEntries.find(entry => entry.id === entryId);
    if (!entryToUpdate) return;
    
    // Calculate new amount based on hourly rate
    const newAmount = (parseFloat(entryToUpdate.hourlyRate) * durationValue).toFixed(2);
    
    // Update the entry
    const updatedEntries = timeEntries.map(entry => {
      if (entry.id === entryId) {
        return {
          ...entry,
          duration: durationValue.toString(),
          amount: newAmount
        };
      }
      return entry;
    });
    
    // Update the state
    setTimeEntries(updatedEntries);
    
    // Add to edited entries for saving later
    setEditedEntries({
      ...editedEntries,
      [entryId]: { duration: durationValue.toString(), amount: newAmount }
    });
    
    // Recalculate totals and weekly data
    const weeklyGroups = groupEntriesByWeek(updatedEntries);
    setWeeklyData(weeklyGroups);
    
    // Update totals
    const newTotalHours = updatedEntries.reduce(
      (sum, entry) => sum + parseFloat(entry.duration || "0"), 
      0
    );
    const newTotalAmount = updatedEntries.reduce(
      (sum, entry) => sum + parseFloat(entry.amount || "0"), 
      0
    );
    
    setTotalHours(newTotalHours);
    setTotalAmount(newTotalAmount);
  };
  
  // Add new additional item
  const handleAddItem = () => {
    const newItem = {
      id: Date.now(), // Use timestamp as ID
      description: "Additional Item",
      amount: "0.00",
      rawValue: "0.00" // Store raw input value
    };
    
    setAdditionalItems([...additionalItems, newItem]);
  };
  
  // Update additional item
  const handleUpdateAdditionalItem = (id: number, field: 'description' | 'amount', value: string) => {
    const updatedItems = additionalItems.map(item => {
      if (item.id === id) {
        if (field === 'amount') {
          // For amount field, store raw input and formatted amount separately
          return { 
            ...item, 
            rawValue: value, // Store the raw value for editing
            amount: value ? parseFloat(value).toString() : "0" // Store parsed value for calculations
          };
        } else {
          return { ...item, [field]: value };
        }
      }
      return item;
    });
    
    setAdditionalItems(updatedItems);
  };
  
  // Remove additional item
  const handleRemoveAdditionalItem = (id: number) => {
    setAdditionalItems(additionalItems.filter(item => item.id !== id));
  };

  // Calculate total due including additional items
  const calculateTotalDue = () => {
    const entriesTotal = totalAmount;
    const additionalItemsTotal = additionalItems.reduce(
      (sum, item) => sum + (parseFloat(String(item.amount)) || 0),
      0
    );
    
    return entriesTotal + additionalItemsTotal;
  };

  // Get currency symbol based on client/settings
  const getCurrencySymbol = () => {
    const currency = client?.currency || settings?.defaultCurrency || "USD";
    return currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'RSD' ? 'RSD ' : '$';
  };

  // Format currency with proper symbol
  const formatCurrency = (amount: number) => {
    return `${getCurrencySymbol()}${amount.toFixed(2)}`;
  };

  // Handle saving the invoice
  const handleSaveInvoice = async () => {
    try {
      setIsLoading(true);
      
      // Get edited entries in the format needed for storage
      const editedEntriesList = Object.entries(editedEntries).map(([entryId, values]) => {
        const entry = timeEntries.find(e => e.id === parseInt(entryId));
        if (!entry) return null;
        
        return {
          id: parseInt(entryId),
          duration: values.duration,
          amount: values.amount,
          description: entry.description,
          projectId: entry.projectId,
          date: entry.date,
          weekNumber: entry.weekNumber,
          weekLabel: entry.weekLabel,
          project: {
            id: entry.project?.id,
            name: entry.project?.name,
            hourlyRate: entry.project?.hourlyRate
          }
        };
      }).filter(Boolean);
      
      // Calculate total
      const total = calculateTotalDue();
      
      // Prepare update data
      const updateData = {
        ...invoice,
        subtotal: totalAmount.toFixed(2),
        total: total.toFixed(2),
        notes: `${notes}

ADDITIONAL_ITEMS:${JSON.stringify(additionalItems)}

EDITED_ENTRIES:${JSON.stringify(editedEntriesList)}`
      };
      
      // Save invoice
      await apiRequest("PUT", `/api/invoices/${invoice.id}`, updateData);
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      
      setIsLoading(false);
      toast({
        title: "Invoice Updated",
        description: "Your invoice has been updated successfully."
      });
      
      onSave();
    } catch (error) {
      console.error("Error saving invoice:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to save invoice. Please try again."
      });
    }
  };

  // Export to PDF
  const handleExportPdf = async () => {
    if (!invoice || !client || !settings) return;
    
    try {
      setIsLoading(true);
      
      // Create filename
      const filename = `invoice-${invoice.invoiceNumber.replace("INV-", "")}.pdf`;
      
      // Get all edited entries to ensure PDF gets most current data
      const currentEditedEntries = Object.entries(editedEntries).map(([entryId, values]) => {
        const entry = timeEntries.find(e => e.id === parseInt(entryId));
        if (!entry) return null;
        
        return {
          ...entry,
          duration: values.duration,
          amount: values.amount
        };
      }).filter(Boolean);
      
      // Replace edited entries in time entries array
      const updatedTimeEntries = timeEntries.map(entry => {
        const edited = currentEditedEntries.find(e => e?.id === entry.id);
        return edited || entry;
      });
      
      // Prepare export data
      const exportData = {
        timeEntries: updatedTimeEntries, // Use updated entries with current edits
        weeklyData,
        totalHours,
        totalAmount,
        timeFormat: "decimal",
        clientCurrency: client.currency || settings.defaultCurrency || "USD",
        additionalItems,
        hasEditedData: Object.keys(editedEntries).length > 0,
        useWeeklyGrouping: true // Force weekly grouping in PDF export
      };
      
      console.log("Exporting invoice with data:", {
        entriesCount: updatedTimeEntries.length,
        additionalItemsCount: additionalItems.length,
        totalAmount: totalAmount
      });
      
      // Generate PDF - pass current notes instead of relying on invoice.notes which has metadata
      await generatePdf({
        filename,
        type: "invoice",
        invoice: {
          ...invoice,
          notes: notes // Use the clean notes from the form
        },
        client,
        settings,
        reportData: exportData,
        showDueDate: true
      });
      
      setIsLoading(false);
      toast({
        title: "PDF Generated",
        description: `Invoice has been exported as ${filename}`
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again."
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="invoice-preview-container">
      <h2 className="text-2xl font-semibold mb-4">Invoice Preview</h2>
      <div className="text-gray-500 mb-8">INV-{invoice.invoiceNumber.replace("INV-", "")}</div>
      
      {/* From/To Section */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-medium mb-2">From</h3>
          <div className="text-sm space-y-1">
            <p>{settings?.businessName}</p>
            <p>{settings?.businessAddress}</p>
            <p>{settings?.businessCity}, {settings?.businessState} {settings?.businessZipCode}</p>
            <p>{settings?.businessEmail}</p>
            <p>Tax ID: {settings?.businessTaxId}</p>
          </div>
        </div>
        
        <div>
          <h3 className="font-medium mb-2">To</h3>
          <div className="text-sm space-y-1">
            <p>{client?.name}</p>
            <p>{client?.address}</p>
            <p>{client?.city} {client?.zipCode}</p>
            <p>{client?.country}</p>
          </div>
        </div>
      </div>
      
      {/* Invoice/Payment Details */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-medium mb-2">Invoice Details</h3>
          <div className="text-sm space-y-1">
            <p>Invoice Number: {invoice.invoiceNumber}</p>
            <p>Issue Date: {getFormattedDate(invoice.issueDate)}</p>
            {invoice.dueDate && <p>Due Date: {getFormattedDate(invoice.dueDate)}</p>}
          </div>
        </div>
        
        <div>
          <h3 className="font-medium mb-2">Payment Details</h3>
          <div className="text-sm space-y-1">
            <p>Bank Name: {settings?.bankName}</p>
            <p>Account Name: {settings?.bankAccountName}</p>
            <p>Account Number: {settings?.bankAccountNumber}</p>
            {settings?.bankSortCode && <p>Sort Code: {settings?.bankSortCode}</p>}
          </div>
        </div>
      </div>
      
      {/* Time Entries Table */}
      <div className="border rounded-md mb-8">
        <table className="min-w-full">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="p-3 text-left">Week</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-right">Hours</th>
              <th className="p-3 text-right">Rate</th>
              <th className="p-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {weeklyData.map(week => (
              <React.Fragment key={week.weekLabel}>
                {/* Week header row */}
                <tr className="bg-gray-50 font-medium">
                  <td colSpan={4} className="p-3">
                    {week.weekLabel}
                  </td>
                  <td className="p-3 text-right">
                    {formatCurrency(week.totalAmount)}
                  </td>
                </tr>
                
                {/* Week entries */}
                {week.entries.map(entry => (
                  <tr key={`entry-${entry.id}`} className="text-sm">
                    <td className="p-3 text-gray-500">Week {week.weekNumber}</td>
                    <td className="p-3">
                      {entry.description} ({format(new Date(entry.date), "MMM d")})
                    </td>
                    <td className="p-3 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-20 text-right border rounded p-1"
                        value={parseFloat(entry.duration).toFixed(2)}
                        onChange={(e) => {
                          // Replace commas with dots for consistency
                          const sanitizedValue = e.target.value.replace(',', '.');
                          handleEditDuration(entry.id, sanitizedValue);
                        }}
                      />
                    </td>
                    <td className="p-3 text-right text-gray-500">
                      {formatCurrency(parseFloat(entry.hourlyRate))}
                    </td>
                    <td className="p-3 text-right">
                      {formatCurrency(parseFloat(entry.amount))}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            
            {/* Removed additional items section from here to only show after subtotal */}
            
            {/* Subtotal row */}
            <tr className="font-medium bg-gray-50">
              <td colSpan={2} className="p-3">Subtotal</td>
              <td className="p-3 text-right">{totalHours.toFixed(2)}</td>
              <td></td>
              <td className="p-3 text-right">{formatCurrency(totalAmount)}</td>
            </tr>
            
            {/* Add item section */}
            {additionalItems.map((item, index) => (
              <tr key={`additional-${item.id}`} className="text-sm">
                <td colSpan={3} className="p-3">
                  <input
                    type="text"
                    className="w-full border rounded p-1"
                    value={item.description}
                    onChange={(e) => handleUpdateAdditionalItem(item.id, 'description', e.target.value)}
                  />
                </td>
                <td className="p-3"></td>
                <td className="p-3 text-right flex items-center justify-end">
                  <div className="flex items-center">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-24 text-right border rounded p-1 mr-2"
                      value={item.rawValue || item.amount}
                      onChange={(e) => {
                        // Replace commas with dots for consistency
                        const sanitizedValue = e.target.value.replace(',', '.');
                        handleUpdateAdditionalItem(item.id, 'amount', sanitizedValue);
                      }}
                    />
                    <button 
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleRemoveAdditionalItem(item.id)}
                    >
                      ×
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            
            {/* Add item button row - centered */}
            <tr>
              <td colSpan={5} className="p-3 text-center">
                <button 
                  onClick={handleAddItem} 
                  className="text-sm text-blue-500 hover:text-blue-700 inline-flex items-center"
                >
                  <span className="mr-1">+</span> Add Item
                </button>
              </td>
            </tr>
            
            {/* Total due row */}
            <tr className="font-bold bg-blue-500 text-white">
              <td colSpan={4} className="p-3">Total Due</td>
              <td className="p-3 text-right">{formatCurrency(calculateTotalDue())}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Notes Section */}
      <div className="mb-8">
        <h3 className="font-medium mb-2">Notes</h3>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full"
        />
      </div>
      
      {/* Action Buttons */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={handleSaveInvoice}>
          Save Invoice
        </Button>
        <Button onClick={handleExportPdf}>
          <FileText className="h-4 w-4 mr-2" /> PDF
        </Button>
      </div>
    </div>
  );
}