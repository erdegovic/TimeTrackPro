import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit, FileSpreadsheet, File } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/pdf-generator";
import { formatTime, formatCurrency } from "@/lib/utils/timeUtils";
import { Client, Settings, TimeFormat } from "@shared/schema";

interface InvoicePreviewProps {
  reportData: any;
  clientId: number;
  onEditInvoice?: () => void;
}

export default function InvoicePreview({ reportData, clientId, onEditInvoice }: InvoicePreviewProps) {
  const { toast } = useToast();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  
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
  
  // Get tax settings from business settings
  useEffect(() => {
    if (settings) {
      const taxEnabled = typeof settings.enableTax === 'boolean' ? settings.enableTax : false;
      const rate = typeof settings.defaultTaxRate === 'number' 
        ? settings.defaultTaxRate 
        : parseFloat(settings.defaultTaxRate?.toString() || '0');
      
      setEnableTax(taxEnabled);
      setTaxRate(rate);
    }
  }, [settings]);
  
  const issueDate = format(new Date(), "MMMM d, yyyy");
  const dueDate = format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), "MMMM d, yyyy");
  
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
        taxRate: enableTax ? taxRate : 0,
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
    
    generatePdf({
      filename,
      reportData,
      client,
      settings,
      invoiceNumber,
      issueDate,
      dueDate,
      notes,
      type: "invoice"
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
              <p><span className="text-gray-500">Due Date:</span> {dueDate}</p>
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
                      ${weekData.totalAmount.toFixed(2)}
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
                          {formatTime(
                            typeof entry.adjustedDuration === 'number' 
                              ? entry.adjustedDuration 
                              : typeof entry.duration === 'number' 
                                ? entry.duration 
                                : parseFloat(entry.duration || '0'), 
                            reportData.timeFormat as TimeFormat
                          )}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 border-r">
                          {client?.currency 
                            ? formatCurrency(parseFloat(entry.hourlyRate), client.currency)
                            : `$${parseFloat(entry.hourlyRate).toFixed(2)}`}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                          {client?.currency 
                            ? formatCurrency(parseFloat(entry.amount), client.currency)
                            : `$${parseFloat(entry.amount).toFixed(2)}`}
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
                    ? formatCurrency(reportData.totalAmount, client.currency)
                    : `$${reportData.totalAmount.toFixed(2)}`}
                </td>
              </tr>
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
              <tr className="bg-primary bg-opacity-5 font-semibold">
                <td colSpan={4} className="px-6 py-3 text-sm text-gray-900 text-right border-r">Total Due</td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-primary">
                  {client?.currency
                    ? formatCurrency(
                        enableTax 
                          ? reportData.totalAmount * (1 + taxRate / 100) 
                          : reportData.totalAmount, 
                        client.currency
                      )
                    : `$${(enableTax 
                        ? reportData.totalAmount * (1 + taxRate / 100) 
                        : reportData.totalAmount).toFixed(2)}`}
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
            <Button variant="outline" onClick={onEditInvoice}>
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
