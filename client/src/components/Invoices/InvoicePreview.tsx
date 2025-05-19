import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit, FileSpreadsheet, File, Plus, Minus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/pdf-generator-fixed";
import { formatTime, formatCurrency, parseTime } from "@/lib/utils/timeUtils";
import { Client, Settings, TimeFormat } from "@shared/schema";

interface InvoicePreviewProps {
  reportData: any;
  clientId: number;
  onEditInvoice?: () => void;
}

export default function InvoicePreview({ reportData, clientId, onEditInvoice }: InvoicePreviewProps) {
  const { toast } = useToast();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editableEntries, setEditableEntries] = useState<any[]>([]);
  const [additionalItems, setAdditionalItems] = useState<{
    description: string;
    amount: number;
    id: number;
  }[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  
  // Fetch next invoice number
  const { data: invoiceNumberData } = useQuery({
    queryKey: ["/api/next-invoice-number"],
    queryFn: async () => {
      const response = await fetch("/api/next-invoice-number");
      if (!response.ok) throw new Error("Failed to fetch next invoice number");
      return response.json();
    }
  });
  
  // Set invoice number when data is available
  useEffect(() => {
    if (invoiceNumberData?.invoiceNumber) {
      setInvoiceNumber(invoiceNumberData.invoiceNumber);
    }
  }, [invoiceNumberData]);
  
  // Fetch client data
  const { data: client } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}`);
      if (!res.ok) throw new Error("Failed to fetch client");
      return res.json();
    },
    enabled: !!clientId
  });
  
  // Fetch business settings
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });
  
  const [notes, setNotes] = useState(
    "Thank you for your business. Payment is due within 15 days of invoice date.\nPlease include the invoice number in your payment reference."
  );
  const [taxRate, setTaxRate] = useState(0);
  const [enableTax, setEnableTax] = useState(false);
  const [showDueDate, setShowDueDate] = useState(true);
  
  // Get tax settings from business settings
  useEffect(() => {
    if (settings) {
      const taxEnabled = typeof settings.enableTax === 'boolean' ? settings.enableTax : false;
      const rate = typeof settings.defaultTaxRate === 'number' 
        ? settings.defaultTaxRate 
        : parseFloat(settings.defaultTaxRate?.toString() || '0');
      
      setEnableTax(taxEnabled);
      setTaxRate(rate);
      
      // Check if showDueDate setting exists and set it
      if (typeof settings.showDueDate === 'boolean') {
        setShowDueDate(settings.showDueDate);
      }
    }
  }, [settings]);
  
  const issueDate = format(new Date(), "MMMM d, yyyy");
  const dueDate = format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), "MMMM d, yyyy");
  
  // Initialize editable entries when report data changes
  useEffect(() => {
    if (reportData && reportData.timeEntries) {
      // Create a deep copy of time entries with additional editing properties
      const editableData = reportData.timeEntries.map((entry: any) => ({
        ...entry,
        originalDuration: entry.adjustedDuration || entry.duration,
        editedDuration: entry.adjustedDuration || entry.duration,
        originalAmount: parseFloat(entry.amount)
      }));
      
      setEditableEntries(editableData);
      
      // Set initial subtotal
      setSubtotal(reportData.totalAmount);
      
      // Calculate initial total
      const initialTax = enableTax ? reportData.totalAmount * (taxRate / 100) : 0;
      setTotal(reportData.totalAmount + initialTax);
    }
  }, [reportData, enableTax, taxRate]);
  
  // Handle toggling edit mode
  const handleToggleEdit = () => {
    if (!isEditing) {
      setIsEditing(true);
    } else {
      // Exit edit mode and reset entries if needed
      setIsEditing(false);
      // If you want to discard changes when exiting, uncomment:
      // if (reportData && reportData.timeEntries) {
      //   const resetData = reportData.timeEntries.map((entry: any) => ({
      //     ...entry,
      //     editedDuration: entry.adjustedDuration || entry.duration,
      //   }));
      //   setEditableEntries(resetData);
      // }
    }
  };
  
  // Update time entry duration and recalculate amounts
  const updateEntryDuration = (entryId: number, newDuration: number, timeFormat: TimeFormat) => {
    setEditableEntries(prev => {
      const updated = prev.map(entry => {
        if (entry.id === entryId) {
          // Calculate new amount based on rate and new duration
          const hourlyRate = parseFloat(entry.hourlyRate);
          const newAmount = hourlyRate * newDuration;
          
          return {
            ...entry,
            editedDuration: newDuration,
            amount: newAmount.toString()
          };
        }
        return entry;
      });
      
      // Recalculate totals
      recalculateTotals(updated);
      
      return updated;
    });
  };
  
  // Calculate additional items total
  const getAdditionalItemsTotal = () => {
    return additionalItems.reduce((sum, item) => sum + item.amount, 0);
  };
  
  // Recalculate subtotal and total based on current entries and additional items
  const recalculateTotals = (entries = editableEntries) => {
    // Sum up all entry amounts (subtotal only includes time entries)
    const entriesTotal = entries.reduce((sum, entry) => sum + parseFloat(entry.amount), 0);
    
    // Set new subtotal (without additional items)
    setSubtotal(entriesTotal);
    
    // Calculate additional items total separately
    const additionalTotal = getAdditionalItemsTotal();
    
    // Calculate tax based on subtotal only
    const tax = enableTax ? entriesTotal * (taxRate / 100) : 0;
    
    // Set total (subtotal + additional items + tax)
    setTotal(entriesTotal + additionalTotal + tax);
  };
  
  // Add a new additional item
  const addItem = () => {
    const newItems = [
      ...additionalItems, 
      { 
        id: Date.now(), 
        description: "Additional Item", 
        amount: 0 
      }
    ];
    setAdditionalItems(newItems);
    
    // Force recalculation immediately after adding an item
    setTimeout(() => {
      recalculateTotals(editableEntries);
    }, 0);
  };
  
  // Update an additional item
  const updateAdditionalItem = (id: number, field: 'description' | 'amount', value: string) => {
    // First update the item data
    const updatedItems = additionalItems.map(item => {
      if (item.id === id) {
        if (field === 'amount') {
          return { ...item, [field]: parseFloat(value) || 0 };
        }
        return { ...item, [field]: value };
      }
      return item;
    });
    
    // Set the updated items state
    setAdditionalItems(updatedItems);
    
    // Immediately recalculate totals with the new data
    const additionalTotal = updatedItems.reduce((sum, item) => sum + item.amount, 0);
    const entriesTotal = editableEntries.reduce((sum, entry) => sum + parseFloat(entry.amount), 0);
    const tax = enableTax ? entriesTotal * (taxRate / 100) : 0;
    
    setSubtotal(entriesTotal);
    setTotal(entriesTotal + additionalTotal + tax);
  };
  
  // Remove an additional item
  const removeItem = (id: number) => {
    // Filter out the item to be removed
    const filteredItems = additionalItems.filter(item => item.id !== id);
    
    // Update the state
    setAdditionalItems(filteredItems);
    
    // Immediately recalculate totals with the updated data
    const additionalTotal = filteredItems.reduce((sum, item) => sum + item.amount, 0);
    const entriesTotal = editableEntries.reduce((sum, entry) => sum + parseFloat(entry.amount), 0);
    const tax = enableTax ? entriesTotal * (taxRate / 100) : 0;
    
    setSubtotal(entriesTotal);
    setTotal(entriesTotal + additionalTotal + tax);
  };
  
  const handleCreateInvoice = async () => {
    if (!reportData || !client) {
      toast({
        title: "Error",
        description: "Missing client or report data",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log("Creating invoice with report data:", reportData);
      
      // Get time entry IDs for marking as invoiced
      const timeEntryIds = reportData.timeEntries.map((entry: any) => entry.id);
      
      // Calculate tax and total
      const subtotal = reportData.totalAmount;
      const tax = enableTax ? subtotal * (taxRate / 100) : 0;
      const total = subtotal + tax;
      
      // Create invoice with all necessary fields
      const invoiceData = {
        clientId: client.id,
        amount: total, // Use the total amount including tax
        subtotal: subtotal,
        tax: tax,
        taxRate: String(enableTax ? taxRate : 0), // Send as string to match database schema
        totalHours: reportData.totalHours,
        notes,
        timeEntryIds,
        currency: client.currency || 'USD', // Include currency
        issueDate: format(new Date(), 'yyyy-MM-dd'),
        dueDate: format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        invoiceNumber: invoiceNumber,
        status: 'draft'
      };
      
      console.log("Sending invoice data to server:", invoiceData);
      
      const response = await apiRequest("POST", "/api/invoices", invoiceData);
      console.log("Invoice creation response:", response);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      
      toast({
        title: "Invoice created",
        description: "Your invoice has been created successfully.",
      });
      
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create invoice. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const exportAsPdf = () => {
    if (!reportData || !client || !settings) return;
    
    const filename = `invoice-${invoiceNumber.replace('INV-', '')}.pdf`;
    
    // Create a modified version of reportData that includes all edited values
    const modifiedReportData = {
      ...reportData,
      timeEntries: editableEntries,
      totalAmount: subtotal,
      totalHours: editableEntries.reduce((sum, entry) => {
        // Use the edited duration from editableEntries
        const duration = typeof entry.editedDuration === 'number' 
          ? entry.editedDuration 
          : typeof entry.duration === 'number'
            ? entry.duration
            : parseFloat(entry.duration || '0');
        return sum + duration;
      }, 0),
      additionalItems: additionalItems,
      subtotal: subtotal,
      total: total
    };
    
    generatePdf({
      filename,
      reportData: modifiedReportData,
      client,
      settings,
      invoiceNumber,
      issueDate,
      dueDate,
      notes,
      type: "invoice",
      showDueDate: showDueDate
    });
    
    toast({
      title: "Invoice exported",
      description: `Your invoice has been exported as ${filename}`,
    });
  };
  
  if (!reportData || !client || !settings) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow rounded-lg mb-6">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Invoice Preview</h2>
        <p className="mt-1 text-sm text-gray-500">{invoiceNumber}</p>
      </div>
      
      <div className="p-6">
        <div className="mb-8 flex justify-between">
          <div>
            <div className="text-gray-900 font-medium">From</div>
            <div className="text-sm text-gray-600 mt-2">
              <p>{settings.businessName}</p>
              <p>{settings.businessAddress}</p>
              <p>{settings.businessCity}, {settings.businessState} {settings.businessZipCode}</p>
              <p>{settings.businessEmail}</p>
              <p>Tax ID: {settings.businessTaxId}</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-gray-900 font-medium">To</div>
            <div className="text-sm text-gray-600 mt-2">
              <p>{client.name}</p>
              <p>{client.address}</p>
              <p>{client.city}, {client.state} {client.zipCode}</p>
              <p>{client.email}</p>
              {client.taxId && <p>Tax ID: {client.taxId}</p>}
            </div>
          </div>
        </div>
        
        <div className="mb-8 flex justify-between">
          <div>
            <div className="text-gray-900 font-medium">Invoice Details</div>
            <div className="text-sm text-gray-600 mt-2">
              <p><span className="text-gray-500">Invoice Number:</span> {invoiceNumber}</p>
              <p><span className="text-gray-500">Issue Date:</span> {issueDate}</p>
              {showDueDate && <p><span className="text-gray-500">Due Date:</span> {dueDate}</p>}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-gray-900 font-medium">Payment Details</div>
            <div className="text-sm text-gray-600 mt-2">
              <p><span className="text-gray-500">Bank Name:</span> {settings.bankName}</p>
              <p><span className="text-gray-500">Account Name:</span> {settings.bankAccountName}</p>
              <p><span className="text-gray-500">Account Number:</span> {settings.bankAccountNumber}</p>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto mb-8">
          <table className="min-w-full divide-y divide-gray-200 border">
            <thead>
              <tr className="bg-gray-50">
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Week</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Description</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Hours</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Rate</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.weeklyData.map((weekData: any) => (
                <>
                  <tr key={`week-${weekData.weekNumber}`} className="bg-gray-50 font-medium">
                    <td colSpan={4} className="px-6 py-2 text-sm text-gray-900 border-r">
                      {weekData.weekLabel}
                    </td>
                    <td className="px-6 py-2 text-sm text-gray-900 text-right">
                      {client?.currency 
                        ? formatCurrency(weekData.totalAmount, client.currency)
                        : `$${weekData.totalAmount.toFixed(2)}`}
                    </td>
                  </tr>
                  
                  {weekData.entries
                    .filter((entry: any) => 
                      client && entry.client && entry.client.id === client.id
                    )
                    .map((entry: any, index: number) => (
                      <tr key={`entry-${entry.id}-${index}`}>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 border-r">
                          Week {weekData.weekNumber}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-900 border-r">
                          {entry.description} ({format(new Date(entry.date), "MMM d")})
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-mono text-gray-900 border-r">
                          {isEditing ? (
                            <input
                              type="text"
                              className="w-24 h-8 p-1 text-sm font-mono border rounded"
                              defaultValue={formatTime(
                                 editableEntries.find(e => e.id === entry.id)?.editedDuration || 
                                 (typeof entry.adjustedDuration === 'number' 
                                   ? entry.adjustedDuration 
                                   : typeof entry.duration === 'number' 
                                      ? entry.duration 
                                      : parseFloat(entry.duration || '0')),
                                 reportData.timeFormat as TimeFormat
                              )}
                              onBlur={(e) => {
                                const timeValue = e.target.value;
                                const durationInHours = parseTime(timeValue, reportData.timeFormat as TimeFormat);
                                updateEntryDuration(entry.id, durationInHours, reportData.timeFormat as TimeFormat);
                              }}
                            />
                          ) : (
                            formatTime(
                              editableEntries.find(e => e.id === entry.id)?.editedDuration ||
                              (typeof entry.adjustedDuration === 'number' 
                                ? entry.adjustedDuration 
                                : typeof entry.duration === 'number' 
                                   ? entry.duration 
                                   : parseFloat(entry.duration || '0')), 
                              reportData.timeFormat as TimeFormat
                            )
                          )}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 border-r">
                          {client?.currency 
                            ? formatCurrency(parseFloat(entry.hourlyRate), client.currency)
                            : `$${parseFloat(entry.hourlyRate).toFixed(2)}`}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                          {client?.currency 
                            ? formatCurrency(
                                editableEntries.find(e => e.id === entry.id)?.amount
                                  ? parseFloat(editableEntries.find(e => e.id === entry.id)?.amount || '0')
                                  : parseFloat(entry.amount),
                                client.currency
                              )
                            : `$${(
                                editableEntries.find(e => e.id === entry.id)?.amount
                                  ? parseFloat(editableEntries.find(e => e.id === entry.id)?.amount || '0')
                                  : parseFloat(entry.amount)
                              ).toFixed(2)}`}
                        </td>
                      </tr>
                    ))
                  }
                </>
              ))}
              
              <tr className="bg-gray-100 font-medium">
                <td colSpan={2} className="px-6 py-3 text-sm text-gray-900 border-r">Subtotal</td>
                <td className="px-6 py-3 whitespace-nowrap text-sm font-mono text-gray-900 border-r">
                  {formatTime(
                    typeof reportData.totalHours === 'number' 
                      ? reportData.totalHours 
                      : parseFloat(reportData.totalHours || '0'), 
                    reportData.timeFormat as TimeFormat
                  )}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 border-r"></td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                  {client?.currency
                    ? formatCurrency(subtotal > 0 ? subtotal : reportData.totalAmount, client.currency)
                    : `$${(subtotal > 0 ? subtotal : reportData.totalAmount).toFixed(2)}`}
                </td>
              </tr>
              
              {/* Additional items */}
              {additionalItems.map(item => (
                <tr key={`additional-${item.id}`}>
                  <td colSpan={2} className={`px-6 py-3 text-sm ${isEditing ? "text-blue-600" : "text-gray-900"} border-r`}>
                    {isEditing ? (
                      <Input
                        type="text"
                        className="w-full h-8 p-1 text-sm"
                        value={item.description}
                        onChange={(e) => updateAdditionalItem(item.id, 'description', e.target.value)}
                      />
                    ) : (
                      item.description
                    )}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 border-r"></td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 border-r">
                    {isEditing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Minus className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                    {isEditing ? (
                      <input
                        type="number"
                        className="w-24 h-8 p-1 text-sm text-right border rounded"
                        defaultValue={item.amount.toString()}
                        onBlur={(e) => updateAdditionalItem(item.id, 'amount', e.target.value)}
                      />
                    ) : (
                      client?.currency
                        ? formatCurrency(item.amount, client.currency)
                        : `$${item.amount.toFixed(2)}`
                    )}
                  </td>
                </tr>
              ))}
              
              {/* Add item button (only visible in edit mode) */}
              {isEditing && (
                <tr>
                  <td colSpan={5} className="px-6 py-2 text-center border-t border-dashed">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={addItem}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Item
                    </Button>
                  </td>
                </tr>
              )}
              {/* Only show tax if it's enabled */}
              {enableTax && (
                <tr>
                  <td colSpan={4} className="px-6 py-3 text-sm text-gray-900 text-right border-r">
                    Tax ({taxRate}%)
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                    {client?.currency
                      ? formatCurrency(reportData.totalAmount * (taxRate / 100), client.currency)
                      : `$${(reportData.totalAmount * (taxRate / 100)).toFixed(2)}`}
                  </td>
                </tr>
              )}
              <tr className="bg-primary font-semibold">
                <td colSpan={4} className="px-6 py-3 text-sm text-white text-right border-r">Total Due</td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-white">
                  {client?.currency
                    ? formatCurrency(total, client.currency)
                    : `$${total.toFixed(2)}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="mb-6">
          <div className="text-gray-900 font-medium mb-2">Notes</div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-sm text-gray-600 bg-gray-50 p-4 rounded-md h-24"
          />
        </div>
        
        <div className="flex justify-between">
          <div>
            <Button variant="outline" onClick={isEditing ? handleToggleEdit : handleToggleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              {isEditing ? "Done Editing" : "Edit Invoice"}
            </Button>
          </div>
          <div className="space-x-2">
            <Button variant="outline" onClick={handleCreateInvoice}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Save Invoice
            </Button>
            <Button onClick={exportAsPdf}>
              <File className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
