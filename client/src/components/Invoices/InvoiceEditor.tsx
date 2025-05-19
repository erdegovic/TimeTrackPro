import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generatePdf } from "@/lib/pdf-generator";
import { formatCurrency, formatTime, formatDate } from "@/lib/utils/timeUtils";
import { Plus, Minus, Save, FileDown, Calculator } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface InvoiceEditorProps {
  clientId?: number;
  invoiceId?: number;
  preselectedTimeEntries?: any[];
  onInvoiceSaved?: (invoiceId: number) => void;
}

export default function InvoiceEditor({
  clientId,
  invoiceId,
  preselectedTimeEntries = [],
  onInvoiceSaved
}: InvoiceEditorProps) {
  const { toast } = useToast();
  
  // State for invoice data
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(clientId);
  const [selectedTimeEntries, setSelectedTimeEntries] = useState<any[]>([]);
  const [additionalItems, setAdditionalItems] = useState<{description: string; amount: string}[]>([]);
  const [notes, setNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [showDueDate, setShowDueDate] = useState(true);
  const [enableTax, setEnableTax] = useState(false);
  const [taxRate, setTaxRate] = useState("0");
  
  // Calculate totals
  const [subtotal, setSubtotal] = useState(0);
  const [tax, setTax] = useState(0);
  const [total, setTotal] = useState(0);
  
  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
    enabled: !clientId
  });
  
  // Fetch client's projects and time entries
  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ["/api/projects", selectedClientId],
    queryFn: async () => {
      const data = await apiRequest(`/api/projects`);
      return data.filter((p: any) => p.clientId === selectedClientId);
    },
    enabled: !!selectedClientId
  });
  
  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"]
  });

  // Fetch next invoice number
  const { data: nextInvoiceNumber } = useQuery({
    queryKey: ["/api/next-invoice-number"],
    enabled: !invoiceId
  });
  
  // Fetch time entries for selected client projects
  const { data: timeEntries, isLoading: isLoadingTimeEntries } = useQuery({
    queryKey: ["/api/time-entries", selectedClientId],
    queryFn: async () => {
      const entries = await apiRequest("/api/time-entries");
      
      // Filter entries by selected client's projects
      if (projects && projects.length > 0) {
        const projectIds = projects.map((p: any) => p.id);
        return entries.filter((entry: any) => 
          projectIds.includes(entry.projectId) && 
          !entry.invoiceId // Only show unbilled entries
        );
      }
      return [];
    },
    enabled: !!selectedClientId && !!projects
  });
  
  // Fetch specific invoice data if editing
  const { data: invoice, isLoading: isLoadingInvoice } = useQuery({
    queryKey: ["/api/invoices", invoiceId],
    queryFn: async () => {
      if (invoiceId) {
        return apiRequest(`/api/invoices/${invoiceId}`);
      }
    },
    enabled: !!invoiceId
  });
  
  // Mutation for saving invoice
  const saveMutation = useMutation({
    mutationFn: async (invoiceData: any) => {
      if (invoiceId) {
        return apiRequest(`/api/invoices/${invoiceId}`, {
          method: "PUT",
          body: JSON.stringify(invoiceData)
        });
      } else {
        return apiRequest("/api/invoices", {
          method: "POST",
          body: JSON.stringify(invoiceData)
        });
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({
        title: invoiceId ? "Invoice updated" : "Invoice created",
        description: `Invoice ${data.invoiceNumber} has been ${invoiceId ? "updated" : "created"}.`
      });
      if (onInvoiceSaved) {
        onInvoiceSaved(data.id);
      }
    },
    onError: (error) => {
      console.error("Error saving invoice:", error);
      toast({
        title: "Error",
        description: "Failed to save invoice. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Initialize from invoice if editing
  useEffect(() => {
    if (invoice) {
      setSelectedClientId(invoice.clientId);
      setInvoiceNumber(invoice.invoiceNumber);
      setIssueDate(invoice.issueDate);
      setDueDate(invoice.dueDate);
      setNotes(invoice.notes || "");
      setShowDueDate(true);
      setEnableTax(!!invoice.tax && invoice.tax > 0);
      setTaxRate(invoice.taxRate?.toString() || "0");
      
      // Parse additional items from notes if present
      if (invoice.notes && invoice.notes.includes("ADDITIONAL_ITEMS:")) {
        try {
          const parts = invoice.notes.split("ADDITIONAL_ITEMS:");
          setNotes(parts[0].trim());
          const items = JSON.parse(parts[1].trim());
          setAdditionalItems(items);
        } catch (e) {
          console.error("Failed to parse additional items from notes:", e);
        }
      }
      
      // We need to fetch invoice time entries separately
      apiRequest(`/api/time-entries`).then((allEntries) => {
        const invoiceEntries = allEntries.filter((entry: any) => entry.invoiceId === invoiceId);
        setSelectedTimeEntries(invoiceEntries);
        calculateTotals(invoiceEntries, additionalItems, enableTax ? parseFloat(taxRate) : 0);
      });
    }
  }, [invoice, invoiceId]);
  
  // Initialize new invoice data
  useEffect(() => {
    if (!invoiceId && nextInvoiceNumber) {
      setInvoiceNumber(`INV-${nextInvoiceNumber}`);
    }
    
    if (settings) {
      // Apply settings defaults
      setEnableTax(settings.enableTax);
      setTaxRate(settings.defaultTaxRate || "0");
      setShowDueDate(settings.showDueDate === true);
    }
    
    if (preselectedTimeEntries && preselectedTimeEntries.length > 0) {
      setSelectedTimeEntries(preselectedTimeEntries);
      calculateTotals(preselectedTimeEntries, additionalItems, enableTax ? parseFloat(taxRate) : 0);
    }
  }, [nextInvoiceNumber, settings, preselectedTimeEntries, invoiceId]);
  
  // Calculate totals whenever relevant data changes
  useEffect(() => {
    calculateTotals(selectedTimeEntries, additionalItems, enableTax ? parseFloat(taxRate) : 0);
  }, [selectedTimeEntries, additionalItems, enableTax, taxRate]);
  
  // Handle client selection
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(parseInt(clientId));
    setSelectedTimeEntries([]);
  };
  
  // Toggle time entry selection
  const toggleTimeEntry = (entry: any) => {
    if (selectedTimeEntries.some(e => e.id === entry.id)) {
      setSelectedTimeEntries(selectedTimeEntries.filter(e => e.id !== entry.id));
    } else {
      setSelectedTimeEntries([...selectedTimeEntries, entry]);
    }
  };
  
  // Add additional item
  const handleAddItem = () => {
    setAdditionalItems([...additionalItems, { description: "", amount: "0" }]);
  };
  
  // Update additional item
  const handleUpdateItem = (index: number, field: 'description' | 'amount', value: string) => {
    const updatedItems = [...additionalItems];
    updatedItems[index][field] = value;
    setAdditionalItems(updatedItems);
  };
  
  // Remove additional item
  const handleRemoveItem = (index: number) => {
    setAdditionalItems(additionalItems.filter((_, i) => i !== index));
  };
  
  // Calculate totals from time entries and additional items
  const calculateTotals = (
    entries: any[], 
    items: {description: string; amount: string}[],
    taxRatePercent: number
  ) => {
    // Calculate subtotal from time entries
    let entriesTotal = 0;
    entries.forEach(entry => {
      const duration = parseFloat(String(entry.duration) || "0");
      const project = projects?.find((p: any) => p.id === entry.projectId);
      const rate = project?.hourlyRate || 0;
      entriesTotal += duration * rate;
    });
    
    // Add additional items
    let itemsTotal = 0;
    items.forEach(item => {
      itemsTotal += parseFloat(item.amount || "0") || 0;
    });
    
    const newSubtotal = entriesTotal + itemsTotal;
    const newTax = newSubtotal * (taxRatePercent / 100);
    const newTotal = newSubtotal + newTax;
    
    setSubtotal(newSubtotal);
    setTax(newTax);
    setTotal(newTotal);
  };
  
  // Format currency amount for display
  const formatAmount = (amount: number) => {
    const client = clients?.find((c: any) => c.id === selectedClientId);
    const currency = client?.currency || settings?.defaultCurrency || "USD";
    return formatCurrency(amount, currency);
  };
  
  // Handle invoice save
  const handleSaveInvoice = () => {
    // Validation
    if (!selectedClientId) {
      toast({
        title: "Missing client",
        description: "Please select a client for this invoice.",
        variant: "destructive"
      });
      return;
    }
    
    if (!selectedTimeEntries.length && !additionalItems.length) {
      toast({
        title: "Empty invoice",
        description: "Please add at least one time entry or additional item.",
        variant: "destructive"
      });
      return;
    }
    
    // Prepare notes with any additional items appended as JSON
    let finalNotes = notes;
    if (additionalItems.length > 0) {
      finalNotes = `${notes}\nADDITIONAL_ITEMS:${JSON.stringify(additionalItems)}`;
    }
    
    // Prepare invoice data
    const invoiceData = {
      clientId: selectedClientId,
      invoiceNumber,
      issueDate,
      dueDate,
      notes: finalNotes,
      subtotal: subtotal.toString(),
      tax: tax.toString(),
      taxRate: taxRate,
      total: total.toString(),
      status: "draft",
      timeEntryIds: selectedTimeEntries.map(entry => entry.id)
    };
    
    // Submit mutation
    saveMutation.mutate(invoiceData);
  };
  
  // Handle PDF generation
  const handleGeneratePdf = () => {
    try {
      // Get client and prepare data
      const client = clients?.find((c: any) => c.id === selectedClientId);
      
      if (!client || !settings) {
        toast({
          title: "Error",
          description: "Missing client or settings data required for PDF generation.",
          variant: "destructive"
        });
        return;
      }
      
      // Create reportData structure for time entries
      const reportData = {
        timeEntries: selectedTimeEntries.map(entry => {
          const project = projects?.find((p: any) => p.id === entry.projectId);
          const duration = parseFloat(String(entry.duration) || "0");
          const rate = project?.hourlyRate || 0;
          
          return {
            ...entry,
            project,
            amount: (duration * rate).toString()
          };
        }),
        additionalItems
      };
      
      // Generate invoice data
      const invoiceData = {
        id: invoiceId || 0,
        clientId: selectedClientId,
        invoiceNumber,
        issueDate,
        dueDate,
        notes,
        subtotal: subtotal.toString(),
        tax: tax.toString(),
        taxRate,
        total: total.toString(),
        status: "draft"
      };
      
      // Generate PDF
      const filename = `invoice-${invoiceNumber.replace('INV-', '')}.pdf`;
      
      generatePdf({
        filename,
        invoice: invoiceData,
        client,
        settings,
        reportData,
        type: "invoice",
        showDueDate
      });
      
      toast({
        title: "PDF generated",
        description: `Your invoice has been exported as ${filename}`,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const isLoading = isLoadingProjects || isLoadingTimeEntries || isLoadingInvoice;
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
          <CardDescription>
            Enter the basic details for this invoice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Client Selection */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select
                disabled={!!clientId || isLoading}
                value={selectedClientId?.toString()}
                onValueChange={handleClientChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client: any) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Invoice Number */}
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-####"
              />
            </div>
          </div>
          
          {/* Dates */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="dueDate">Due Date</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={showDueDate}
                    onCheckedChange={setShowDueDate}
                    id="showDueDate"
                  />
                  <Label htmlFor="showDueDate" className="text-sm">Show on invoice</Label>
                </div>
              </div>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!showDueDate}
              />
            </div>
          </div>
          
          {/* Tax Settings */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={enableTax}
                  onCheckedChange={setEnableTax}
                  id="enableTax"
                />
                <Label htmlFor="enableTax">Enable Tax</Label>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                min="0"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                disabled={!enableTax}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Time Entries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Time Entries</CardTitle>
            <CardDescription>
              Select time entries to include in this invoice
            </CardDescription>
          </div>
          <div className="text-sm text-gray-500">
            {selectedTimeEntries.length} entries selected
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading time entries...</div>
          ) : selectedClientId ? (
            timeEntries && timeEntries.length > 0 ? (
              <div className="border rounded-md divide-y">
                {timeEntries.map((entry: any) => {
                  const project = projects?.find((p: any) => p.id === entry.projectId);
                  const duration = parseFloat(String(entry.duration) || "0");
                  const rate = project?.hourlyRate || 0;
                  const amount = duration * rate;
                  const isSelected = selectedTimeEntries.some(e => e.id === entry.id);
                  
                  return (
                    <div 
                      key={entry.id}
                      className={`p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50 
                        ${isSelected ? 'bg-blue-50' : ''}`}
                      onClick={() => toggleTimeEntry(entry)}
                    >
                      <div className="flex flex-col">
                        <div className="font-medium">{entry.description}</div>
                        <div className="text-sm text-gray-500">
                          {project?.name} • {formatDate(entry.date)} • 
                          {formatTime(duration, settings?.defaultTimeFormat || 'decimal')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div>{formatAmount(amount)}</div>
                        <div className="text-sm text-gray-500">
                          {formatAmount(rate)}/hr
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                No unbilled time entries found for this client.
              </div>
            )
          ) : (
            <div className="text-center py-4 text-gray-500">
              Please select a client to view available time entries.
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Additional Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Additional Items</CardTitle>
            <CardDescription>
              Add extra line items to your invoice
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAddItem}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
        </CardHeader>
        <CardContent>
          {additionalItems.length > 0 ? (
            <div className="space-y-3">
              {additionalItems.map((item, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-grow">
                    <Label htmlFor={`item-desc-${index}`} className="text-xs">Description</Label>
                    <Input
                      id={`item-desc-${index}`}
                      value={item.description}
                      onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                      placeholder="Item description"
                    />
                  </div>
                  <div className="w-32">
                    <Label htmlFor={`item-amount-${index}`} className="text-xs">Amount</Label>
                    <Input
                      id={`item-amount-${index}`}
                      value={item.amount}
                      onChange={(e) => handleUpdateItem(index, 'amount', e.target.value)}
                      placeholder="0.00"
                      type="number"
                      step="0.01"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              No additional items. Click "Add Item" to add one.
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>
            Add any notes or payment instructions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter notes or payment instructions..."
            rows={4}
          />
        </CardContent>
      </Card>
      
      {/* Totals */}
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatAmount(subtotal)}</span>
              </div>
              
              {additionalItems.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{item.description || 'Additional item'}:</span>
                  <span>{formatAmount(parseFloat(item.amount) || 0)}</span>
                </div>
              ))}
              
              {enableTax && (
                <div className="flex justify-between text-sm pt-1 border-t">
                  <span>Tax ({taxRate}%):</span>
                  <span>{formatAmount(tax)}</span>
                </div>
              )}
              
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total:</span>
                <span>{formatAmount(total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button 
          variant="outline" 
          onClick={handleGeneratePdf}
          disabled={!selectedClientId || (selectedTimeEntries.length === 0 && additionalItems.length === 0)}
        >
          <FileDown className="h-4 w-4 mr-2" />
          Preview PDF
        </Button>
        
        <Button 
          onClick={handleSaveInvoice}
          disabled={!selectedClientId || (selectedTimeEntries.length === 0 && additionalItems.length === 0) || saveMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Saving..." : (invoiceId ? "Update Invoice" : "Save Invoice")}
        </Button>
      </div>
    </div>
  );
}