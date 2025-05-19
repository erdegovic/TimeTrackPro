import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Plus, Minus, Edit2, Save, X, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Client, Project, TimeEntry, Settings } from "@shared/schema";
import { formatTime, formatCurrency } from "@/lib/utils/timeUtils";
import { generatePdf } from "@/lib/pdf-generator";

interface InvoicePreviewProps {
  clientId: number;
  reportData: any;
  additionalItems?: any[];
  setAdditionalItems?: (items: any[]) => void;
  notes?: string;
  setNotes?: (notes: string) => void;
  showDueDate?: boolean;
  setShowDueDate?: (show: boolean) => void;
  dueDate?: string;
  setDueDate?: (date: string) => void;
  invoiceNumber?: string;
  issueDate?: string;
  onEditInvoice?: () => void;
}

export default function InvoicePreview({
  clientId,
  reportData,
  additionalItems,
  setAdditionalItems,
  notes,
  setNotes,
  showDueDate = true,
  setShowDueDate,
  dueDate,
  setDueDate,
  invoiceNumber,
  issueDate
}: InvoicePreviewProps) {
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editedItem, setEditedItem] = useState<{ description: string; amount: string }>({ description: "", amount: "0" });
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | null>(null);
  const [editedEntry, setEditedEntry] = useState<any>(null);
  
  // Fetch client data
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  
  // Fetch settings
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });
  
  // Get selected client
  const client = clients.find(c => c.id === clientId);
  
  // Get currency from client or settings
  const currency = client?.currency || settings?.defaultCurrency || "USD";
  
  // Format time entries and calculate totals
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  
  // Update time entries when reportData changes
  useEffect(() => {
    if (reportData && reportData.timeEntries) {
      console.log("Setting time entries from reportData:", reportData.timeEntries.length);
      
      // Apply any editable properties that might have been added during editing
      const enrichedEntries = reportData.timeEntries.map((entry: any) => {
        // Make sure each entry has these properties for editing
        return {
          ...entry,
          editedDuration: entry.editedDuration !== undefined ? entry.editedDuration : null,
          editedAmount: entry.editedAmount !== undefined ? entry.editedAmount : null,
        };
      });
      
      setTimeEntries(enrichedEntries);
      
      // Calculate total duration and amount
      calculateTotals(enrichedEntries);
    }
  }, [reportData]);
  
  // Calculate totals when time entries or additional items change
  const calculateTotals = (entries: any[]) => {
    // Calculate duration and base amount from entries
    let duration = 0;
    let amount = 0;
    
    entries.forEach(entry => {
      // Use edited duration if available, otherwise use regular duration
      const entryDuration = entry.editedDuration !== undefined && entry.editedDuration !== null
        ? parseFloat(String(entry.editedDuration))
        : parseFloat(String(entry.duration || 0));
      
      duration += entryDuration;
      
      // Use edited amount if available, otherwise calculate from duration and rate
      const entryAmount = entry.editedAmount !== undefined && entry.editedAmount !== null
        ? parseFloat(String(entry.editedAmount))
        : entry.project && entry.project.hourlyRate
          ? entryDuration * parseFloat(String(entry.project.hourlyRate))
          : 0;
      
      amount += entryAmount;
    });
    
    // Add additional items (safely)
    const additionalAmount = additionalItems && Array.isArray(additionalItems) 
      ? additionalItems.reduce(
          (sum, item) => sum + parseFloat(String(item?.amount || 0)), 
          0
        )
      : 0;
    
    setTotalDuration(duration);
    setSubtotal(amount);
    setTotalAmount(amount + additionalAmount);
  };
  
  // Update totals when additional items change
  useEffect(() => {
    calculateTotals(timeEntries);
  }, [additionalItems]);
  
  // Add a new additional item
  const handleAddItem = () => {
    const newItems = [...additionalItems, { description: "Additional Item", amount: "0" }];
    setAdditionalItems(newItems);
    setEditingItemIndex(newItems.length - 1);
    setEditedItem({ description: "Additional Item", amount: "0" });
  };
  
  // Remove an additional item
  const handleRemoveItem = (index: number) => {
    const newItems = [...additionalItems];
    newItems.splice(index, 1);
    setAdditionalItems(newItems);
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
    }
  };
  
  // Start editing an additional item
  const handleEditItem = (index: number) => {
    setEditingItemIndex(index);
    setEditedItem({ ...additionalItems[index] });
  };
  
  // Save edited additional item
  const handleSaveItem = () => {
    if (editingItemIndex === null) return;
    
    const newItems = [...additionalItems];
    newItems[editingItemIndex] = { 
      description: editedItem.description,
      amount: editedItem.amount
    };
    
    setAdditionalItems(newItems);
    setEditingItemIndex(null);
  };
  
  // Cancel editing additional item
  const handleCancelEditItem = () => {
    setEditingItemIndex(null);
  };
  
  // Start editing a time entry
  const handleEditEntry = (index: number) => {
    setEditingEntryIndex(index);
    setEditedEntry({
      ...timeEntries[index],
      editedDuration: timeEntries[index].editedDuration !== undefined && timeEntries[index].editedDuration !== null
        ? timeEntries[index].editedDuration
        : parseFloat(String(timeEntries[index].duration || 0)),
      editedAmount: timeEntries[index].editedAmount !== undefined && timeEntries[index].editedAmount !== null
        ? timeEntries[index].editedAmount
        : timeEntries[index].project && timeEntries[index].project.hourlyRate
          ? parseFloat(String(timeEntries[index].duration || 0)) * parseFloat(String(timeEntries[index].project.hourlyRate))
          : 0
    });
  };
  
  // Save edited time entry
  const handleSaveEntry = () => {
    if (editingEntryIndex === null || !editedEntry) return;
    
    const newEntries = [...timeEntries];
    newEntries[editingEntryIndex] = {
      ...newEntries[editingEntryIndex],
      editedDuration: parseFloat(String(editedEntry.editedDuration || 0)),
      editedAmount: parseFloat(String(editedEntry.editedAmount || 0))
    };
    
    setTimeEntries(newEntries);
    calculateTotals(newEntries);
    setEditingEntryIndex(null);
    setEditedEntry(null);
    
    // Update the reportData if needed
    if (reportData) {
      reportData.timeEntries = newEntries;
      reportData.totalAmount = totalAmount;
    }
  };
  
  // Cancel editing time entry
  const handleCancelEditEntry = () => {
    setEditingEntryIndex(null);
    setEditedEntry(null);
  };
  
  // Format durations based on time format
  const formatDuration = (duration: number) => {
    return formatTime(duration, reportData?.timeFormat || "decimal");
  };
  
  // Format currency 
  const formatAmount = (amount: number) => {
    return formatCurrency(amount, currency);
  };
  
  // Toggle showing due date
  const handleToggleDueDate = (value: boolean) => {
    if (setShowDueDate) {
      setShowDueDate(value);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Invoice header */}
      <div className="flex justify-between">
        <div>
          <h2 className="text-2xl font-bold">INVOICE</h2>
          <p className="text-lg">{invoiceNumber || "DRAFT"}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">Issue Date</p>
          <p>{issueDate ? format(new Date(issueDate), "MMMM d, yyyy") : format(new Date(), "MMMM d, yyyy")}</p>
          
          {/* Due date section with toggle */}
          {setShowDueDate && (
            <div className="mt-2 flex items-center justify-end space-x-2">
              <Switch 
                id="show-due-date" 
                checked={showDueDate}
                onCheckedChange={handleToggleDueDate}
              />
              <Label htmlFor="show-due-date">Show Due Date</Label>
            </div>
          )}
          
          {showDueDate && (
            <>
              <p className="font-semibold mt-2">Due Date</p>
              {setDueDate ? (
                <Input 
                  type="date" 
                  value={dueDate} 
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-right"
                />
              ) : (
                <p>{dueDate ? format(new Date(dueDate), "MMMM d, yyyy") : "Not Set"}</p>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* From/To section */}
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h3 className="font-semibold text-sm uppercase text-gray-500">From</h3>
          <div className="mt-1">
            <p className="font-semibold">{settings?.businessName || "Your Business"}</p>
            <p>{settings?.businessAddress || "123 Business Street"}</p>
            <p>{settings?.businessCity || "City"}, {settings?.businessState || "State"} {settings?.businessZipCode || "12345"}</p>
            <p>{settings?.businessCountry || "Country"}</p>
            <p>{settings?.businessEmail || "email@example.com"}</p>
            <p>Tax ID: {settings?.businessTaxId || "N/A"}</p>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-sm uppercase text-gray-500">To</h3>
          <div className="mt-1">
            <p className="font-semibold">{client?.name || "Client Name"}</p>
            <p>{client?.address || ""}</p>
            <p>
              {client?.city || ""}{client?.city && client?.state ? ", " : ""}{client?.state || ""}
              {(client?.city || client?.state) && client?.zipCode ? " " : ""}
              {client?.zipCode || ""}
            </p>
            <p>{client?.country || ""}</p>
            <p>{client?.email || ""}</p>
            {client?.taxId && <p>Tax ID: {client.taxId}</p>}
          </div>
        </div>
      </div>
      
      {/* Time entries table */}
      <div className="mt-8">
        <div className="bg-gray-100 p-4 rounded-t-md flex font-semibold">
          <div className="flex-1">Description</div>
          <div className="w-24 text-right">Hours</div>
          <div className="w-24 text-right">Rate</div>
          <div className="w-24 text-right">Amount</div>
          <div className="w-16"></div>
        </div>
        
        <div className="border-x border-b rounded-b-md">
          {timeEntries.length > 0 ? (
            timeEntries.map((entry, index) => (
              <div key={entry.id} className="flex p-3 border-b items-center">
                {editingEntryIndex === index ? (
                  // Editing mode for time entry
                  <>
                    <div className="flex-1">
                      <p className="font-medium">{entry.description}</p>
                      <p className="text-sm text-gray-500">
                        {entry.project?.name && `Project: ${entry.project.name}`}
                      </p>
                    </div>
                    <div className="w-24">
                      <Input 
                        type="number" 
                        value={editedEntry.editedDuration} 
                        onChange={(e) => setEditedEntry({
                          ...editedEntry,
                          editedDuration: parseFloat(e.target.value)
                        })}
                        step="0.01"
                        className="text-right"
                      />
                    </div>
                    <div className="w-24 text-right">
                      {formatAmount(entry.project?.hourlyRate || 0)}
                    </div>
                    <div className="w-24">
                      <Input 
                        type="number" 
                        value={editedEntry.editedAmount} 
                        onChange={(e) => setEditedEntry({
                          ...editedEntry,
                          editedAmount: parseFloat(e.target.value)
                        })}
                        step="0.01"
                        className="text-right"
                      />
                    </div>
                    <div className="w-16 flex justify-end space-x-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleSaveEntry}
                        className="h-8 w-8"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleCancelEditEntry}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  // Display mode for time entry
                  <>
                    <div className="flex-1">
                      <p className="font-medium">{entry.description}</p>
                      <p className="text-sm text-gray-500">
                        {entry.project?.name && `Project: ${entry.project.name}`}
                      </p>
                    </div>
                    <div className="w-24 text-right">
                      {formatDuration(
                        entry.editedDuration !== undefined && entry.editedDuration !== null
                          ? entry.editedDuration
                          : parseFloat(String(entry.duration || 0))
                      )}
                    </div>
                    <div className="w-24 text-right">
                      {formatAmount(entry.project?.hourlyRate || 0)}
                    </div>
                    <div className="w-24 text-right">
                      {formatAmount(
                        entry.editedAmount !== undefined && entry.editedAmount !== null
                          ? entry.editedAmount
                          : entry.project?.hourlyRate
                            ? parseFloat(String(entry.duration || 0)) * parseFloat(String(entry.project.hourlyRate))
                            : 0
                      )}
                    </div>
                    <div className="w-16 text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEditEntry(index)}
                        className="h-8 w-8"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">No time entries found for this invoice.</div>
          )}
        </div>
      </div>
      
      {/* Additional items section */}
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium">Additional Items</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAddItem}
            className="h-8"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
        </div>
        
        {additionalItems && additionalItems.length > 0 ? (
          <div className="space-y-2">
            {additionalItems.map((item, index) => (
              <div key={index} className="flex items-center border p-2 rounded">
                {editingItemIndex === index ? (
                  // Editing mode for additional item
                  <>
                    <div className="flex-1 mr-2">
                      <Input 
                        value={editedItem.description} 
                        onChange={(e) => setEditedItem({ ...editedItem, description: e.target.value })}
                        placeholder="Description"
                      />
                    </div>
                    <div className="w-32 mr-2">
                      <Input 
                        type="number" 
                        value={editedItem.amount} 
                        onChange={(e) => setEditedItem({ ...editedItem, amount: e.target.value })}
                        step="0.01"
                        className="text-right"
                      />
                    </div>
                    <div className="flex space-x-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleSaveItem}
                        className="h-8 w-8"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleCancelEditItem}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  // Display mode for additional item
                  <>
                    <div className="flex-1">{item.description}</div>
                    <div className="w-32 text-right">{formatAmount(parseFloat(String(item.amount)))}</div>
                    <div className="flex space-x-1 ml-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEditItem(index)}
                        className="h-8 w-8"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveItem(index)}
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-center p-4 border rounded">No additional items</div>
        )}
      </div>
      
      {/* Totals section */}
      <div className="mt-6 flex justify-end">
        <div className="w-64 space-y-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatAmount(subtotal)}</span>
          </div>
          
          {additionalItems && Array.isArray(additionalItems) && additionalItems.length > 0 ? 
            additionalItems.map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span>{item.description || 'Item'}:</span>
                <span>{formatAmount(parseFloat(String(item.amount || 0)))}</span>
              </div>
            ))
          : null}
          
          <div className="flex justify-between font-bold text-lg pt-2 border-t">
            <span>Total:</span>
            <span>{formatAmount(totalAmount)}</span>
          </div>
        </div>
      </div>
      
      {/* Notes section */}
      <div className="mt-6">
        <label className="block font-medium mb-1">Notes</label>
        {setNotes ? (
          <Textarea 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter notes for this invoice..."
            rows={4}
          />
        ) : (
          <div className="p-4 border rounded">
            {notes || "No notes"}
          </div>
        )}
      </div>
      
      {/* Action buttons */}
      <div className="mt-8 flex justify-end gap-3">
        {client && settings && (
          <Button
            onClick={() => {
              const filename = `invoice-${invoiceNumber || "draft"}.pdf`;
              
              // Generate PDF
              generatePdf({
                filename,
                client,
                settings,
                reportData,
                type: "invoice",
                notes,
                invoiceNumber,
                issueDate,
                dueDate,
                showDueDate
              });
            }}
            variant="outline"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        )}
        
        <Button 
          onClick={() => onEditInvoice && onEditInvoice()} 
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Invoice
        </Button>
      </div>
    </div>
  );
}