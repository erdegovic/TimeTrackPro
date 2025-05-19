import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Plus, Minus, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/pdf-generator-fixed-new";
import { formatTime, formatCurrency, parseTime, adjustTime, roundTime } from "@/lib/utils/timeUtils";
import { Invoice, Client, Settings, TimeFormat, RoundingType } from "@shared/schema";

interface InvoiceEditViewProps {
  invoice: Invoice;
  onSave: () => void;
  onCancel: () => void;
}

export default function InvoiceEditView({ invoice, onSave, onCancel }: InvoiceEditViewProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("decimal");
  const [roundingType, setRoundingType] = useState<RoundingType>("none");
  const [adjustmentPercentage, setAdjustmentPercentage] = useState(0);
  const [applyAdjustment, setApplyAdjustment] = useState(false);
  const [showDueDate, setShowDueDate] = useState(true);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [additionalItems, setAdditionalItems] = useState<any[]>([]);
  const [editMode, setEditMode] = useState<Record<number, boolean>>({});
  const [editedValues, setEditedValues] = useState<Record<number, { duration: string; amount: string }>>({});

  // Fetch client data
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch settings for defaults
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  // Get client for this invoice
  const client = clients.find(c => c.id === invoice.clientId);

  // Initialize component when invoice data is available
  useEffect(() => {
    if (invoice && clients.length > 0 && settings) {
      loadInvoiceData();
    }
  }, [invoice?.id, clients.length, settings]);

  // Load invoice data including time entries and parse notes/additional items
  const loadInvoiceData = async () => {
    try {
      setIsLoading(true);
      console.log("Loading invoice data for editing:", invoice);

      // Set basic invoice details
      setDueDate(invoice.dueDate || "");
      setShowDueDate(settings?.showDueDate || true);
      setTimeFormat(settings?.defaultTimeFormat as TimeFormat || "decimal");

      // Parse notes and additional items
      let invoiceNotes = invoice.notes || "";
      let additionalItemsList: any[] = [];
      let editedEntriesList: any[] = [];

      // Extract notes
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
        setInvoiceData({
          timeEntries: [],
          weeklyData: [],
          totalHours: 0,
          totalAmount: 0,
          timeFormat: timeFormat
        });
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
      let enhancedEntries = invoiceEntries.map((entry: any) => {
        // Add project data if missing
        const project = entry.project || projectsMap.get(entry.projectId);
        
        // Calculate amount based on hourly rate
        const hourlyRate = project?.hourlyRate || 0;
        const duration = parseFloat(entry.duration || 0);
        const amount = (hourlyRate * duration).toFixed(2);
        
        return {
          ...entry,
          project,
          hourlyRate,
          amount,
          // Store original values for reference
          originalDuration: entry.duration,
          originalAmount: amount
        };
      });

      // Apply any previously edited values
      if (editedEntriesList.length > 0) {
        const editedMap = new Map();
        editedEntriesList.forEach((edited: any) => {
          editedMap.set(edited.id, edited);
        });

        const newEditedValues: Record<number, { duration: string; amount: string }> = {};
        
        enhancedEntries = enhancedEntries.map((entry: any) => {
          const edited = editedMap.get(entry.id);
          if (edited) {
            // Store edited values in state
            newEditedValues[entry.id] = {
              duration: edited.duration,
              amount: edited.amount
            };
            
            return {
              ...entry,
              duration: edited.duration,
              amount: edited.amount,
              wasEdited: true
            };
          }
          return entry;
        });
        
        setEditedValues(newEditedValues);
      }

      // Group by week
      const weeklyData = groupEntriesByWeek(enhancedEntries);
      
      // Calculate totals
      const totalHours = enhancedEntries.reduce(
        (sum: number, entry: any) => sum + parseFloat(entry.duration || 0), 
        0
      );
      
      const totalAmount = enhancedEntries.reduce(
        (sum: number, entry: any) => sum + parseFloat(entry.amount || 0), 
        0
      );

      // Set the invoice data
      setInvoiceData({
        timeEntries: enhancedEntries,
        weeklyData,
        totalHours,
        totalAmount,
        timeFormat
      });

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

  // Group entries by week
  const groupEntriesByWeek = (entries: any[]) => {
    if (!entries || entries.length === 0) return [];
    
    const weekMap = new Map();
    entries.forEach((entry: any) => {
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
      .sort((a: any, b: any) => a.weekNumber - b.weekNumber);
  };

  // Toggle edit mode for a time entry
  const toggleEditMode = (entryId: number) => {
    setEditMode(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
    
    // Initialize edited values if not already set
    if (!editedValues[entryId]) {
      const entry = invoiceData.timeEntries.find((e: any) => e.id === entryId);
      if (entry) {
        setEditedValues(prev => ({
          ...prev,
          [entryId]: {
            duration: entry.duration,
            amount: entry.amount
          }
        }));
      }
    }
  };

  // Handle duration editing
  const handleEditDuration = (entryId: number, value: string) => {
    if (!invoiceData) return;
    
    const entry = invoiceData.timeEntries.find((e: any) => e.id === entryId);
    if (!entry) return;
    
    // Calculate new amount based on hourly rate
    const hourlyRate = parseFloat(entry.hourlyRate || 0);
    const newDuration = parseFloat(value || 0);
    const newAmount = (hourlyRate * newDuration).toFixed(2);
    
    // Update edited values
    setEditedValues(prev => ({
      ...prev,
      [entryId]: {
        duration: value,
        amount: newAmount
      }
    }));
    
    // Update invoiceData
    updateInvoiceData();
  };

  // Handle amount editing
  const handleEditAmount = (entryId: number, value: string) => {
    setEditedValues(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        amount: value
      }
    }));
    
    updateInvoiceData();
  };

  // Update invoice data with current edited values
  const updateInvoiceData = () => {
    if (!invoiceData) return;
    
    // Apply edited values to entries
    const updatedEntries = invoiceData.timeEntries.map((entry: any) => {
      if (editedValues[entry.id]) {
        return {
          ...entry,
          duration: editedValues[entry.id].duration,
          amount: editedValues[entry.id].amount,
          wasEdited: true
        };
      }
      return entry;
    });
    
    // Recalculate week data
    const updatedWeeklyData = groupEntriesByWeek(updatedEntries);
    
    // Recalculate totals
    const totalHours = updatedEntries.reduce(
      (sum: number, entry: any) => sum + parseFloat(entry.duration || 0), 
      0
    );
    
    const totalAmount = updatedEntries.reduce(
      (sum: number, entry: any) => sum + parseFloat(entry.amount || 0), 
      0
    );
    
    // Update state
    setInvoiceData({
      ...invoiceData,
      timeEntries: updatedEntries,
      weeklyData: updatedWeeklyData,
      totalHours,
      totalAmount
    });
  };

  // Handle adding additional item
  const handleAddItem = () => {
    setAdditionalItems([
      ...additionalItems,
      { id: Date.now(), description: "New Item", amount: 0 }
    ]);
  };

  // Handle removing additional item
  const handleRemoveItem = (id: number) => {
    setAdditionalItems(additionalItems.filter(item => item.id !== id));
  };

  // Handle updating additional item
  const handleUpdateItem = (id: number, field: string, value: string) => {
    setAdditionalItems(additionalItems.map(item => {
      if (item.id === id) {
        return {
          ...item,
          [field]: field === "amount" ? parseFloat(value) : value
        };
      }
      return item;
    }));
  };

  // Apply time adjustments
  const applyTimeAdjustments = () => {
    if (!invoiceData || !invoiceData.timeEntries.length) return;
    
    try {
      // Process each entry
      const adjustedEntries = invoiceData.timeEntries.map((entry: any) => {
        // Get current duration (use edited value if available)
        let duration = parseFloat(editedValues[entry.id]?.duration || entry.duration || 0);
        
        // Apply percentage adjustment if enabled
        if (applyAdjustment) {
          duration = duration * (1 + (adjustmentPercentage / 100));
        }
        
        // Apply rounding if enabled
        if (roundingType !== "none") {
          if (roundingType === "nearest_tenth") {
            duration = Math.round(duration * 10) / 10;
          } else if (roundingType === "nearest_quarter") {
            duration = Math.round(duration * 4) / 4;
          } else if (roundingType === "nearest_half") {
            duration = Math.round(duration * 2) / 2;
          }
        }
        
        // Calculate new amount
        const hourlyRate = parseFloat(entry.hourlyRate || 0);
        const amount = (hourlyRate * duration).toFixed(2);
        
        // Update edited values
        setEditedValues(prev => ({
          ...prev,
          [entry.id]: {
            duration: duration.toString(),
            amount
          }
        }));
        
        return {
          ...entry,
          duration: duration.toString(),
          amount,
          wasEdited: true
        };
      });
      
      // Update invoice data with adjusted entries
      const updatedWeeklyData = groupEntriesByWeek(adjustedEntries);
      
      // Calculate new totals
      const totalHours = adjustedEntries.reduce(
        (sum: number, entry: any) => sum + parseFloat(entry.duration || 0), 
        0
      );
      
      const totalAmount = adjustedEntries.reduce(
        (sum: number, entry: any) => sum + parseFloat(entry.amount || 0), 
        0
      );
      
      // Update state
      setInvoiceData({
        ...invoiceData,
        timeEntries: adjustedEntries,
        weeklyData: updatedWeeklyData,
        totalHours,
        totalAmount
      });
      
      toast({
        title: "Time Adjustments Applied",
        description: "Time entries have been adjusted according to your settings."
      });
    } catch (error) {
      console.error("Error applying time adjustments:", error);
      toast({
        title: "Error",
        description: "Failed to apply time adjustments. Please try again."
      });
    }
  };

  // Handle saving the invoice
  const handleSaveInvoice = async () => {
    if (!invoice || !client || !invoiceData) return;
    
    try {
      setIsLoading(true);
      
      // Get all edited entries
      const editedTimeEntries = Object.entries(editedValues).map(([entryId, values]) => {
        const entry = invoiceData.timeEntries.find((e: any) => e.id === parseInt(entryId));
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
      
      // Calculate total including additional items
      const entriesTotal = invoiceData.totalAmount || 0;
      const additionalItemsTotal = additionalItems.reduce(
        (sum, item) => sum + (typeof item.amount === 'number' ? item.amount : 0),
        0
      );
      const total = entriesTotal + additionalItemsTotal;
      
      // Prepare invoice update data
      const updateData = {
        ...invoice,
        dueDate: dueDate,
        subtotal: entriesTotal.toFixed(2),
        total: total.toFixed(2),
        notes: `${notes}

ADDITIONAL_ITEMS:${JSON.stringify(additionalItems)}

EDITED_ENTRIES:${JSON.stringify(editedTimeEntries)}`
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
    if (!invoice || !client || !settings || !invoiceData) return;
    
    try {
      setIsLoading(true);
      
      // Create filename
      const filename = `invoice-${invoice.invoiceNumber.replace("INV-", "")}.pdf`;
      
      // Prepare export data
      const exportData = {
        ...invoiceData,
        clientCurrency: client.currency || settings.defaultCurrency || "USD",
        additionalItems
      };
      
      // Generate PDF
      await generatePdf({
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

  // Calculate total amount including additional items
  const calculateTotal = () => {
    if (!invoiceData) return 0;
    
    const entriesTotal = invoiceData.totalAmount || 0;
    const additionalItemsTotal = additionalItems.reduce(
      (sum, item) => sum + (typeof item.amount === 'number' ? item.amount : 0),
      0
    );
    
    return entriesTotal + additionalItemsTotal;
  };

  // Get currency symbol based on client settings
  const getCurrencySymbol = () => {
    const currency = client?.currency || settings?.defaultCurrency || "USD";
    return currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'RSD' ? 'RSD ' : '$';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invoice Details */}
      <div className="grid md:grid-cols-2 gap-4">
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
              {invoice.invoiceNumber}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="issueDate">Issue Date</Label>
            <div className="p-2 border rounded bg-muted">
              {invoice.issueDate}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="showDueDate" 
                checked={showDueDate} 
                onCheckedChange={(checked) => setShowDueDate(!!checked)} 
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add invoice notes here..."
              rows={4}
              className="w-full"
            />
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="border p-4 rounded-md space-y-3">
            <h3 className="font-medium">Time Entry Options</h3>
            
            <div className="space-y-2">
              <Label>Format</Label>
              <div className="flex space-x-2">
                <Button
                  variant={timeFormat === "time" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeFormat("time")}
                >
                  Time (hh:mm)
                </Button>
                <Button
                  variant={timeFormat === "decimal" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeFormat("decimal")}
                >
                  Decimal (1.5h)
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Rounding</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={roundingType === "none" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRoundingType("none")}
                >
                  None
                </Button>
                <Button
                  variant={roundingType === "nearest_tenth" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRoundingType("nearest_tenth")}
                >
                  0.1h
                </Button>
                <Button
                  variant={roundingType === "nearest_quarter" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRoundingType("nearest_quarter")}
                >
                  0.25h
                </Button>
                <Button
                  variant={roundingType === "nearest_half" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRoundingType("nearest_half")}
                >
                  0.5h
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="applyAdjustment" 
                  checked={applyAdjustment} 
                  onCheckedChange={(checked) => setApplyAdjustment(!!checked)} 
                />
                <Label htmlFor="applyAdjustment">Adjust Time</Label>
              </div>
              
              {applyAdjustment && (
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={adjustmentPercentage}
                    onChange={(e) => setAdjustmentPercentage(parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                  <span>% increase</span>
                </div>
              )}
            </div>
            
            <Button 
              size="sm"
              onClick={applyTimeAdjustments}
              disabled={!invoiceData?.timeEntries?.length}
            >
              Apply Settings
            </Button>
          </div>
          
          <div className="border p-4 rounded-md space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Additional Items</h3>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleAddItem}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>
            
            {additionalItems.length > 0 ? (
              <div className="space-y-2">
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
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No additional items</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Time Entries Table */}
      <div className="border rounded-md overflow-x-auto">
        {invoiceData && invoiceData.weeklyData && invoiceData.weeklyData.length > 0 ? (
          <div className="invoice-preview">
            {invoiceData.weeklyData.map((week: any) => (
              <div key={week.weekLabel} className="border-b last:border-b-0">
                <div className="bg-muted px-4 py-2 font-medium flex justify-between">
                  <span>{week.weekLabel}</span>
                  <span>
                    {timeFormat === "decimal" 
                      ? `${week.totalHours.toFixed(2)}h` 
                      : formatTime(week.totalHours)
                    } • 
                    {getCurrencySymbol()}{week.totalAmount.toFixed(2)}
                  </span>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {week.entries.map((entry: any) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.project?.name || 'Unknown'}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right">
                          {editMode[entry.id] ? (
                            <Input
                              type="text"
                              value={editedValues[entry.id]?.duration || entry.duration}
                              onChange={(e) => handleEditDuration(entry.id, e.target.value)}
                              className="w-20 text-right"
                            />
                          ) : (
                            <span className={entry.wasEdited ? "font-medium text-primary" : ""}>
                              {timeFormat === "decimal" 
                                ? `${parseFloat(editedValues[entry.id]?.duration || entry.duration).toFixed(2)}h` 
                                : formatTime(parseFloat(editedValues[entry.id]?.duration || entry.duration))
                              }
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {getCurrencySymbol()}{parseFloat(entry.hourlyRate).toFixed(2)}/h
                        </TableCell>
                        <TableCell className="text-right">
                          {editMode[entry.id] ? (
                            <Input
                              type="text"
                              value={editedValues[entry.id]?.amount || entry.amount}
                              onChange={(e) => handleEditAmount(entry.id, e.target.value)}
                              className="w-24 text-right"
                            />
                          ) : (
                            <span className={entry.wasEdited ? "font-medium text-primary" : ""}>
                              {getCurrencySymbol()}{parseFloat(editedValues[entry.id]?.amount || entry.amount).toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => toggleEditMode(entry.id)}
                            title={editMode[entry.id] ? "Save" : "Edit"}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
            
            {/* Additional Items Section */}
            {additionalItems.length > 0 && (
              <div className="border-t">
                <div className="bg-muted px-4 py-2 font-medium">
                  Additional Items
                </div>
                <Table>
                  <TableBody>
                    {additionalItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell colSpan={5}>{item.description}</TableCell>
                        <TableCell className="text-right">
                          {getCurrencySymbol()}{parseFloat(String(item.amount)).toFixed(2)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Total Section */}
            <div className="border-t p-4">
              <div className="flex flex-col items-end space-y-1">
                <div className="flex justify-between w-64">
                  <span className="font-medium">Subtotal:</span>
                  <span>{getCurrencySymbol()}{invoiceData.totalAmount.toFixed(2)}</span>
                </div>
                
                {additionalItems.length > 0 && (
                  <div className="flex justify-between w-64">
                    <span className="font-medium">Additional Items:</span>
                    <span>
                      {getCurrencySymbol()}
                      {additionalItems.reduce((sum, item) => sum + (parseFloat(String(item.amount)) || 0), 0).toFixed(2)}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between w-64 text-lg font-bold">
                  <span>Total:</span>
                  <span>{getCurrencySymbol()}{calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">No time entries found for this invoice.</p>
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="outline" onClick={handleExportPdf} disabled={isLoading}>
          <FileText className="h-4 w-4 mr-2" /> Export PDF
        </Button>
        <Button onClick={handleSaveInvoice} disabled={isLoading}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}