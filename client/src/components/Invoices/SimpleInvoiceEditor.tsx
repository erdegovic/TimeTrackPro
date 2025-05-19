import React, { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Invoice, Client, Settings } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/pdf-generator-fixed-new";

// A simple interface just for the date properties
interface SimpleTimeEntry {
  id: number;
  description: string;
  duration: string;
  date: string;
  amount: string;
  project: { name: string; hourlyRate: string };
}

interface SimpleInvoiceEditorProps {
  invoice: Invoice;
  clients: Client[];
  settings?: Settings;
  onClose: () => void;
  onSave: () => void;
}

export default function SimpleInvoiceEditor({ 
  invoice, 
  clients, 
  settings, 
  onClose, 
  onSave 
}: SimpleInvoiceEditorProps) {
  const { toast } = useToast();
  const [dueDate, setDueDate] = useState(invoice.dueDate || "");
  const [notes, setNotes] = useState(invoice.notes?.split("\n\nADDITIONAL_ITEMS:")[0] || "");
  const [additionalItems, setAdditionalItems] = useState<{id: number; description: string; amount: number}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Immediately parse and set additional items from invoice notes
  React.useEffect(() => {
    if (invoice.notes && invoice.notes.includes("ADDITIONAL_ITEMS:")) {
      try {
        const itemsText = invoice.notes.split("ADDITIONAL_ITEMS:")[1].split("\n\n")[0];
        const parsedItems = JSON.parse(itemsText);
        if (Array.isArray(parsedItems)) {
          setAdditionalItems(parsedItems);
        }
      } catch (e) {
        console.error("Failed to parse additional items:", e);
      }
    }
  }, [invoice.notes]);
  
  // Find the client for this invoice
  const client = clients.find(c => c.id === invoice.clientId);
  
  // Handle saving invoice changes
  const handleSave = async () => {
    if (!invoice || !client) return;
    
    try {
      setIsLoading(true);
      
      // Update invoice with changes
      const updateData = {
        ...invoice,
        dueDate,
        notes: `${notes}\n\nADDITIONAL_ITEMS:${JSON.stringify(additionalItems)}`
      };
      
      // Save changes
      await apiRequest("PUT", `/api/invoices/${invoice.id}`, updateData);
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      
      setIsLoading(false);
      toast({
        title: "Invoice Updated",
        description: "The invoice has been successfully updated."
      });
      
      onSave();
    } catch (error) {
      console.error("Error updating invoice:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to update invoice. Please try again."
      });
    }
  };
  
  // Handle adding a new additional item
  const handleAddItem = () => {
    setAdditionalItems([
      ...additionalItems,
      { id: Date.now(), description: "New Item", amount: 0 }
    ]);
  };
  
  // Handle removing an additional item
  const handleRemoveItem = (id: number) => {
    setAdditionalItems(additionalItems.filter(item => item.id !== id));
  };
  
  // Handle updating an additional item
  const handleUpdateItem = (id: number, field: "description" | "amount", value: string) => {
    setAdditionalItems(additionalItems.map(item => {
      if (item.id === id) {
        return {
          ...item,
          [field]: field === "amount" ? Number(value) : value
        };
      }
      return item;
    }));
  };
  
  // Handle exporting invoice to PDF
  const handleExportPdf = () => {
    if (!invoice || !client || !settings) return;
    
    try {
      setIsLoading(true);
      
      // Generate filename from invoice number
      const filename = `invoice-${invoice.invoiceNumber.replace("INV-", "")}.pdf`;
      
      // Get client currency
      const clientCurrency = client.currency || settings.defaultCurrency || "USD";
      
      // Generate PDF
      generatePdf({
        filename,
        type: "invoice",
        invoice,
        client,
        settings,
        showDueDate: !!dueDate
      });
      
      setIsLoading(false);
      toast({
        title: "PDF Generated",
        description: `Invoice exported as ${filename}`
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
  
  // Calculate invoice totals
  const subtotal = Number(invoice.subtotal || 0);
  const tax = Number(invoice.tax || 0);
  const total = Number(invoice.total || 0);
  
  // Get additional items total
  const additionalItemsTotal = additionalItems.reduce(
    (sum, item) => sum + (typeof item.amount === 'number' ? item.amount : 0), 
    0
  );
  
  // Currency formatting
  const currency = client?.currency || settings?.defaultCurrency || "USD";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Column: Invoice Details */}
      <div className="space-y-4">
        <div className="border rounded-md p-4 space-y-4">
          <h3 className="font-medium">Invoice Details</h3>
          
          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Invoice Number</Label>
            <Input
              id="invoiceNumber"
              value={invoice.invoiceNumber}
              disabled
              className="bg-muted"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Input
              id="client"
              value={client?.name || "Unknown Client"}
              disabled
              className="bg-muted"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="issueDate">Issue Date</Label>
            <Input
              id="issueDate"
              value={invoice.issueDate}
              disabled
              className="bg-muted"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        
        {/* Additional Items */}
        <div className="border rounded-md p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Additional Items</h3>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleAddItem}
            >
              Add Item
            </Button>
          </div>
          
          {additionalItems.length > 0 ? (
            <div className="space-y-3">
              {additionalItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr,auto,auto] gap-2 items-center">
                  <Input
                    value={item.description}
                    onChange={(e) => handleUpdateItem(item.id, "description", e.target.value)}
                    placeholder="Description"
                  />
                  <Input
                    type="number"
                    value={item.amount}
                    onChange={(e) => handleUpdateItem(item.id, "amount", e.target.value)}
                    placeholder="Amount"
                    className="w-24"
                  />
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => handleRemoveItem(item.id)}
                  >
                    X
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No additional items added</p>
          )}
        </div>
      </div>
      
      {/* Right Column: Invoice Summary */}
      <div>
        <div className="border rounded-md p-4 space-y-4">
          <h3 className="font-medium">Invoice Summary</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between border-b pb-2">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            
            {additionalItems.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Additional Items:</div>
                {additionalItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm pl-2">
                    <span>{item.description}</span>
                    <span>{formatCurrency(item.amount, currency)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-b pb-2">
                  <span>Additional Items Total:</span>
                  <span>{formatCurrency(additionalItemsTotal, currency)}</span>
                </div>
              </div>
            )}
            
            {tax > 0 && (
              <div className="flex justify-between border-b pb-2">
                <span>Tax:</span>
                <span>{formatCurrency(tax, currency)}</span>
              </div>
            )}
            
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>{formatCurrency(total + additionalItemsTotal, currency)}</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleExportPdf} disabled={isLoading}>
            Export PDF
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}