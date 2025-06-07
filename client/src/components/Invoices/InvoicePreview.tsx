import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit, FileSpreadsheet, File, Plus, Minus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/enhanced-pdf-generator";
import { formatTime, formatCurrency, parseTime } from "@/lib/utils/timeUtils";
import { Client, Settings, TimeFormat } from "@shared/schema";

interface InvoicePreviewProps {
  reportData: any;
  clientId?: number;
  client?: Client;
  settings?: Settings;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  setDueDate?: (date: string) => void;
  additionalItems?: any[];
  setAdditionalItems?: (items: any[]) => void;
  notes?: string;
  setNotes?: (notes: string) => void;
  showDueDate?: boolean;
  setShowDueDate?: (show: boolean) => void;
  onEditInvoice?: () => void;
  isEditing?: boolean;
  invoice?: any;
}

export default function InvoicePreview({ 
  reportData,
  clientId,
  client: propClient,
  settings: propSettings,
  invoiceNumber: propInvoiceNumber,
  issueDate: propIssueDate,
  dueDate: propDueDate,
  setDueDate,
  additionalItems: propAdditionalItems,
  setAdditionalItems: propSetAdditionalItems, 
  notes: propNotes,
  setNotes: propSetNotes,
  showDueDate: propShowDueDate,
  setShowDueDate: propSetShowDueDate,
  onEditInvoice,
  isEditing = false,
  invoice
}: InvoicePreviewProps) {
  const { toast } = useToast();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [editableEntries, setEditableEntries] = useState<any[]>([]);
  const [additionalItems, setAdditionalItems] = useState<{
    description: string;
    amount: number;
    id: number;
  }[]>(propAdditionalItems || []);
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [notes, setNotes] = useState(propNotes || "");
  const [showDueDate, setShowDueDate] = useState(propShowDueDate !== undefined ? propShowDueDate : true);
  
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
  
  // Note: notes state is already defined above with propNotes
  const [taxRate, setTaxRate] = useState(0);
  const [enableTax, setEnableTax] = useState(false);
  // showDueDate is already defined above
  
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
    if (onEditInvoice) {
      onEditInvoice();
    }
  };
  
  // Update time entry duration and recalculate amounts - fixed to properly handle amounts
  const updateEntryDuration = (entryId: number, newDuration: number, timeFormat: TimeFormat) => {
    console.log(`Updating entry ${entryId} duration to ${newDuration}`);
    
    setEditableEntries(prev => {
      const updated = prev.map(entry => {
        if (entry.id === entryId) {
          // Get hourly rate either from the entry directly or its project
          const hourlyRate = parseFloat(entry.hourlyRate || 
            (entry.project?.hourlyRate ? entry.project.hourlyRate : '0'));
            
          // Calculate new amount based on the hourly rate and new duration
          const newAmount = hourlyRate * newDuration;
          
          console.log(`Entry ${entryId}: New duration=${newDuration}, rate=${hourlyRate}, calculated amount=${newAmount}`);
          
          // Create updated entry with edited values clearly marked
          return {
            ...entry,
            editedDuration: newDuration,      // Store edited duration separately 
            duration: newDuration,            // Also update the main duration field
            editedAmount: newAmount,          // Store edited amount separately
            amount: newAmount.toString(),     // Also update the main amount field
            wasEdited: true                   // Flag that this entry was edited
          };
        }
        return entry;
      });
      
      // Immediately recalculate totals based on updated entries
      recalculateTotals(updated);
      
      // Log the updated entries
      console.log("Updated time entries:", updated);
      
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
      
      // Calculate correct totals based on edited entries
      // Calculate the total hours from all edited entries
      const totalHours = editableEntries.reduce((sum, entry) => {
        // Always use the edited duration value
        const duration = typeof entry.editedDuration === 'number' 
          ? entry.editedDuration 
          : typeof entry.duration === 'number'
            ? entry.duration
            : parseFloat(entry.duration || '0');
        return sum + duration;
      }, 0);
      
      // Calculate the subtotal from all edited entries amounts
      const entriesSubtotal = editableEntries.reduce((sum, entry) => {
        return sum + parseFloat(entry.amount.toString());
      }, 0);
      
      // Add additional items to the total
      const additionalItemsTotal = additionalItems.reduce((sum, item) => {
        return sum + (item.amount || 0);
      }, 0);
      
      // Calculate final subtotal and total
      const subtotal = entriesSubtotal;
      const tax = enableTax ? subtotal * (taxRate / 100) : 0;
      const total = subtotal + additionalItemsTotal + tax;
      
      console.log("Invoice calculated values:", {
        totalHours,
        entriesSubtotal,
        additionalItemsTotal,
        subtotal,
        tax,
        total
      });
      
      // Create invoice with all necessary fields, using the edited values
      const invoiceData = {
        clientId: client.id,
        amount: total, // Use the calculated total with all edited amounts and additional items
        subtotal: subtotal,
        tax: tax,
        taxRate: String(enableTax ? taxRate : 0), // Send as string to match database schema
        totalHours: totalHours, // Use calculated total hours
        notes,
        timeEntryIds,
        currency: client.currency || 'USD', // Include currency
        issueDate: format(new Date(issueDate), 'yyyy-MM-dd'),
        dueDate: format(new Date(dueDate), 'yyyy-MM-dd'),
        invoiceNumber: invoiceNumber,
        status: 'draft',
        // Include additional items as JSON string
        additionalItems: JSON.stringify(additionalItems),
        // Include edited time entries data to preserve edits
        editedEntries: JSON.stringify(editableEntries)
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
    
    const timestamp = new Date().getTime();
    const filename = `invoice-${invoiceNumber.replace('INV-', '')}-${timestamp}.pdf`;
    
    // Make editable entries extremely explicit with clear edits flagged
    const enhancedEntries = editableEntries.map(entry => {
      console.log("Processing entry for PDF export:", entry);
      
      // Get hourly rate (either from entry or project)
      const hourlyRate = parseFloat(entry.hourlyRate || '0');
      
      // Get edited duration (used edited if available, otherwise original)
      const duration = typeof entry.editedDuration === 'number' 
        ? entry.editedDuration 
        : parseFloat(entry.duration || '0');
        
      // Calculate amount based on hourly rate and duration  
      const calculatedAmount = hourlyRate * duration;
      
      // Get the actual amount to use (either from entry or calculated)
      const amount = parseFloat(entry.amount || calculatedAmount.toString());
      
      // Create a new object with explicit edited values
      return {
        ...entry,
        // Strongly flag the edited values to ensure they're used
        edited: true,
        wasEdited: true,
        editedDuration: duration,
        editedAmount: amount,
        // Duplicate these fields to make sure they're picked up
        duration: duration,
        amount: amount,
        // Convert to string to avoid type issues
        amountString: amount.toString(),
        durationString: duration.toString(),
        // Original values for reference
        originalDuration: entry.originalDuration || entry.duration,
        originalAmount: entry.originalAmount || entry.amount,
      };
    });
    
    console.log("Enhanced entries for PDF:", enhancedEntries);
    
    // Calculate the correct total hours and amount from the enhanced entries
    const totalHours = enhancedEntries.reduce((sum, entry) => sum + parseFloat(entry.duration.toString()), 0);
    const totalAmount = enhancedEntries.reduce((sum, entry) => sum + parseFloat(entry.amount.toString()), 0);
    
    console.log(`Modified report data for PDF:`, {
      totalHours,
      totalAmount,
      entriesCount: enhancedEntries.length
    });
    
    // Update each week's data with corrected totals
    const updatedWeeklyData = reportData.weeklyData.map((weekData: any) => {
      // Filter entries for this week that match our enhanced entries
      const weekEntries = enhancedEntries.filter(entry => 
        entry.weekNumber === weekData.weekNumber);
      
      // Calculate corrected total for this week
      const weekTotal = weekEntries.reduce((sum, entry) => 
        sum + parseFloat(entry.amount.toString()), 0);
      
      // Return the updated week data
      return {
        ...weekData,
        entries: weekEntries,
        totalAmount: weekTotal
      };
    });
    
    // Create a modified version of reportData that includes all edited values
    const modifiedReportData = {
      ...reportData,
      timeEntries: enhancedEntries,
      weeklyData: updatedWeeklyData,
      totalHours: totalHours,
      totalAmount: totalAmount,
      subtotal: totalAmount,
      additionalItems: additionalItems,
      total: total,
      // Flag that these entries are edited to force using edited values
      hasEditedEntries: true,
      hasEditedValues: true,
      useEditedValues: true
    };
    
    console.log("Modified report data for PDF:", {
      totalHours: modifiedReportData.totalHours,
      totalAmount: modifiedReportData.totalAmount,
      entriesCount: modifiedReportData.timeEntries.length
    });
    
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
      description: `Your invoice has been exported as ${filename} with all edited values included.`,
    });
  };
  
  if (!reportData || !client || !settings) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Get the selected template from settings
  const currentTemplate = settings?.invoiceTemplate || 'professional';
  
  // Template configurations
  const templateConfigs = {
    professional: {
      headerStyle: "border-b border-gray-300 pb-4 mb-8",
      titleSize: "text-3xl",
      colors: { primary: settings?.invoiceColorTheme || "#1f2937", accent: settings?.invoiceAccentColor || "#3b82f6" }
    },
    modern: {
      headerStyle: "relative mb-8",
      titleSize: "text-4xl",
      colors: { primary: settings?.invoiceColorTheme || "#1f2937", accent: settings?.invoiceAccentColor || "#3b82f6" }
    },
    classic: {
      headerStyle: "text-center border-b border-gray-300 pb-6 mb-8",
      titleSize: "text-2xl",
      colors: { primary: settings?.invoiceColorTheme || "#1f2937", accent: settings?.invoiceAccentColor || "#3b82f6" }
    },
    minimal: {
      headerStyle: "border-b border-gray-200 pb-4 mb-6",
      titleSize: "text-xl",
      colors: { primary: settings?.invoiceColorTheme || "#1f2937", accent: settings?.invoiceAccentColor || "#3b82f6" }
    },
    media: {
      headerStyle: "bg-gradient-to-r border-4 border-gray-800 p-6 mb-8",
      titleSize: "text-4xl",
      colors: { primary: settings?.invoiceColorTheme || "#991b1b", accent: settings?.invoiceAccentColor || "#ef4444" }
    }
  };
  
  const templateConfig = templateConfigs[currentTemplate as keyof typeof templateConfigs] || templateConfigs.professional;

  return (
    <div className="bg-white shadow rounded-lg mb-6">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Invoice Preview - {currentTemplate.charAt(0).toUpperCase() + currentTemplate.slice(1)} Template</h2>
        <p className="mt-1 text-sm text-gray-500">{invoiceNumber}</p>
      </div>
      
      <div className="p-6">
        {/* Media Template with Special Layout */}
        {currentTemplate === 'media' && (
          <div className="mb-8">
            {/* Header with Company Name */}
            <div className="mb-6">
              <h1 
                className="text-5xl font-bold tracking-wider"
                style={{ color: '#8B1538' }}
              >
                {settings?.businessName?.toUpperCase() || "AE PRODUCTIONS"}
              </h1>
              <div className="text-sm text-gray-600 mt-2">
                Professional media services
              </div>
            </div>
            
            {/* Invoice Number and Date in Top Right */}
            <div className="flex justify-between items-start mb-6">
              <div></div>
              <div className="text-right">
                <div 
                  className="text-2xl font-bold mb-1"
                  style={{ color: '#8B1538' }}
                >
                  INV #{invoiceNumber}
                </div>
                <div className="text-sm text-gray-600">
                  Date: {issueDate}
                </div>
              </div>
            </div>
            
            {/* Business Address */}
            {settings?.showCompanyDetails !== false && (
              <div className="text-sm text-gray-600 mb-6">
                {settings?.businessAddress && <div>{settings.businessAddress}</div>}
                {settings?.businessCity && (
                  <div>{settings.businessCity}, {settings.businessState} {settings.businessZipCode}</div>
                )}
                {settings?.businessEmail && <div>{settings.businessEmail}</div>}
                {settings?.businessPhone && <div>{settings.businessPhone}</div>}
              </div>
            )}
            
            {/* Barcode-style Graphic */}
            <div className="mb-8">
              <div className="flex space-x-1 h-8">
                {[...Array(40)].map((_, i) => (
                  <div 
                    key={i} 
                    className="bg-gray-800"
                    style={{ 
                      width: Math.random() > 0.5 ? '3px' : '1px',
                      height: Math.random() > 0.3 ? '100%' : '60%'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Modern Template with Gradient Header */}
        {currentTemplate === 'modern' && (
          <div 
            className="w-full text-white p-6 mb-8 rounded-lg"
            style={{ 
              background: `linear-gradient(135deg, ${templateConfig.colors.primary}, ${templateConfig.colors.accent})` 
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                {settings?.showBusinessName !== false && (
                  <h1 className="text-3xl font-bold mb-2">
                    {settings?.businessName?.toUpperCase() || "YOUR BUSINESS NAME"}
                  </h1>
                )}
                {settings?.showCompanyDetails !== false && (
                  <div className="text-sm opacity-90">
                    {settings?.businessAddress && <div>{settings.businessAddress}</div>}
                    {settings?.businessCity && (
                      <div>{settings.businessCity}, {settings.businessState} {settings.businessZipCode}</div>
                    )}
                    {settings?.businessEmail && <div>{settings.businessEmail}</div>}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xl font-bold mb-2">INV #{invoiceNumber}</div>
                <div className="text-sm">
                  <div>Issued: {issueDate}</div>
                  {showDueDate && <div>Due: {dueDate}</div>}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Standard Header for Other Templates */}
        {currentTemplate !== 'modern' && currentTemplate !== 'media' && (
          <div className={templateConfig.headerStyle}>
            {currentTemplate === 'classic' ? (
              // Classic centered layout
              <div className="text-center">
                <h1 
                  className={`${templateConfig.titleSize} font-bold mb-4`}
                  style={{ color: templateConfig.colors.primary }}
                >
                  INVOICE
                </h1>
                {settings?.showBusinessName !== false && (
                  <div 
                    className="text-xl font-bold mb-4"
                    style={{ color: templateConfig.colors.primary }}
                  >
                    {settings?.businessName || "Your Business Name"}
                  </div>
                )}
                <div className="text-sm text-gray-600 mb-4">
                  <div>Invoice #{invoiceNumber}</div>
                  <div>Date: {issueDate}</div>
                  {showDueDate && <div>Due: {dueDate}</div>}
                </div>
              </div>
            ) : (
              // Professional and Minimal side-by-side layout
              <div className="flex justify-between items-start">
                <div>
                  {settings?.showBusinessName !== false && (
                    <h2 
                      className="text-xl font-bold mb-2"
                      style={{ color: templateConfig.colors.primary }}
                    >
                      {settings?.businessName || "Your Business Name"}
                    </h2>
                  )}
                  {settings?.showCompanyDetails !== false && (
                    <div className="text-sm text-gray-600">
                      {settings?.businessAddress && <div>{settings.businessAddress}</div>}
                      {settings?.businessCity && (
                        <div>{settings.businessCity}, {settings.businessState} {settings.businessZipCode}</div>
                      )}
                      {settings?.businessEmail && <div>{settings.businessEmail}</div>}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <h1 
                    className={`${templateConfig.titleSize} font-bold mb-2`}
                    style={{ color: templateConfig.colors.primary }}
                  >
                    INVOICE
                  </h1>
                  <div className="text-sm text-gray-600">
                    <div>Invoice #{invoiceNumber}</div>
                    <div>Date: {issueDate}</div>
                    {showDueDate && <div>Due: {dueDate}</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Client Information - Media Template */}
        {currentTemplate === 'media' && (
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <div 
                className="text-lg font-bold mb-3"
                style={{ color: '#8B1538' }}
              >
                BILL TO
              </div>
              <div className="text-sm text-gray-700">
                <div className="font-medium">{client.name}</div>
                <div>Sample Producer</div>
                {client.address && <div>{client.address}</div>}
                {client.city && <div>{client.city}, {client.state} {client.zipCode}</div>}
                <div className="mt-2">
                  PO #CLIENT-2023-42
                </div>
              </div>
            </div>
            <div>
              <div 
                className="text-lg font-bold mb-3"
                style={{ color: '#8B1538' }}
              >
                PROJECT DETAILS
              </div>
              <div className="text-sm text-gray-700">
                <div><span className="font-medium">Project:</span> Sample Project</div>
                <div><span className="font-medium">Time Period:</span> 5/7/2025</div>
                <div><span className="font-medium">Currency:</span> {client.currency || 'USD'}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Client Information - Other Templates */}
        {currentTemplate !== 'media' && (
          <div className="mb-8">
            <div 
              className="text-lg font-medium mb-2"
              style={{ color: templateConfig.colors.primary }}
            >
              Bill To:
            </div>
            <div className="text-sm text-gray-600">
              <p className="font-medium">{client.name}</p>
              {client.address && <p>{client.address}</p>}
              {client.city && <p>{client.city}, {client.state} {client.zipCode}</p>}
              {client.email && <p>{client.email}</p>}
              {client.taxId && <p>Tax ID: {client.taxId}</p>}
            </div>
          </div>
        )}
        
        {/* Payment Details Section - Not shown for Media template */}
        {currentTemplate !== 'media' && (
          <div className="mb-8">
            <div 
              className="text-lg font-medium mb-2"
              style={{ color: templateConfig.colors.primary }}
            >
              Payment Details:
            </div>
            <div className="text-sm text-gray-600">
              {settings?.bankName && <p><span className="font-medium">Bank:</span> {settings.bankName}</p>}
              {settings?.bankAccountName && <p><span className="font-medium">Account Name:</span> {settings.bankAccountName}</p>}
              {settings?.bankAccountNumber && <p><span className="font-medium">Account Number:</span> {settings.bankAccountNumber}</p>}
              {settings?.bankSortCode && <p><span className="font-medium">Sort Code:</span> {settings.bankSortCode}</p>}
            </div>
          </div>
        )}
        
        <div className="overflow-x-auto mb-8">
          <table className="min-w-full divide-y divide-gray-200 border">
            <thead>
              <tr 
                className="text-white"
                style={{ 
                  backgroundColor: currentTemplate === 'media' ? '#8B1538' : templateConfig.colors.primary 
                }}
              >
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-gray-300">Description</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-gray-300">Hours</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-gray-300">Rate</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.weeklyData.map((weekData: any) => (
                <>
                  {weekData.entries
                    .filter((entry: any) => 
                      client && entry.client && entry.client.id === client.id
                    )
                    .map((entry: any, index: number) => (
                      <tr 
                        key={`entry-${entry.id}-${index}`}
                        data-entry-id={entry.id}
                        data-edited-duration={editableEntries.find(e => e.id === entry.id)?.editedDuration || entry.duration}
                        data-edited-amount={editableEntries.find(e => e.id === entry.id)?.amount || entry.amount}>
                        <td className="px-6 py-3 text-sm text-gray-900 border-r">
                          {entry.description} ({format(new Date(entry.date), "MMM d")})
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-mono text-gray-900 border-r">
                          {(() => {
                            // Get the actual duration value - use the same logic as the PDF generator
                            let duration = 0;
                            const editedEntry = editableEntries.find(e => e.id === entry.id);
                            
                            if (editedEntry?.editedDuration !== undefined) {
                              duration = typeof editedEntry.editedDuration === 'number' ? editedEntry.editedDuration : parseFloat(String(editedEntry.editedDuration));
                            } else if (entry.adjustedDuration !== undefined && entry.adjustedDuration !== null) {
                              duration = typeof entry.adjustedDuration === 'number' ? entry.adjustedDuration : parseFloat(String(entry.adjustedDuration));
                            } else if (entry.duration !== undefined && entry.duration !== null) {
                              duration = typeof entry.duration === 'number' ? entry.duration : parseFloat(String(entry.duration));
                            }
                            
                            // Ensure valid number
                            if (isNaN(duration) || duration < 0) duration = 0;
                            
                            console.log(`Preview - Entry ${entry.id}: duration=${duration}, original=${entry.duration}, adjusted=${entry.adjustedDuration}`);
                            
                            return isEditing ? (
                              <input
                                type="text"
                                className="w-24 h-8 p-1 text-sm font-mono border rounded"
                                defaultValue={formatTime(duration, reportData.timeFormat as TimeFormat)}
                                onBlur={(e) => {
                                  const timeValue = e.target.value;
                                  const durationInHours = parseTime(timeValue, reportData.timeFormat as TimeFormat);
                                  updateEntryDuration(entry.id, durationInHours, reportData.timeFormat as TimeFormat);
                                }}
                              />
                            ) : (
                              formatTime(duration, reportData.timeFormat as TimeFormat)
                            );
                          })()}
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
            <Button variant="outline" onClick={handleToggleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Invoice
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
