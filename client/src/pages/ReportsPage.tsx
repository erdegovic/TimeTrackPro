import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ReportFilters from "@/components/Reports/ReportFilters";
import ReportTable from "@/components/Reports/ReportTable";
import InvoicePreview from "@/components/Invoices/InvoicePreview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportFilters as ReportFiltersType } from "@shared/schema";

export default function ReportsPage() {
  const [currentFilters, setCurrentFilters] = useState<ReportFiltersType | null>(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);
  const [additionalItems, setAdditionalItems] = useState<any[]>([]);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceShowDueDate, setInvoiceShowDueDate] = useState(true);

  const handleApplyFilters = (filters: ReportFiltersType) => {
    setCurrentFilters(filters);
  };

  const handleGenerateInvoice = (reportData: any) => {
    // Check if we have a specific client selected or need to prompt for one
    if (currentFilters?.clientId) {
      setSelectedClientId(currentFilters.clientId);
      setInvoiceData(reportData);
      setShowInvoicePreview(true);
    } else {
      // Get unique clients from the report data
      const clientIds = new Set<number>();
      reportData.timeEntries.forEach((entry: any) => {
        if (entry.client) {
          clientIds.add(entry.client.id);
        }
      });

      // If only one client in the report, use that
      if (clientIds.size === 1) {
        setSelectedClientId(Array.from(clientIds)[0]);
        setInvoiceData(reportData);
        setShowInvoicePreview(true);
      } else {
        // If multiple clients, show an alert to select a specific client
        alert("Please filter by a specific client before generating an invoice.");
      }
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">
          Generate detailed reports of your tracked time and create invoices.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>
            Select parameters to generate your report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportFilters onApplyFilters={handleApplyFilters} />
        </CardContent>
      </Card>

      {currentFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Report Results</CardTitle>
            <CardDescription>
              Time entries matching your filters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReportTable 
              filters={currentFilters} 
              onGenerateInvoice={handleGenerateInvoice}
            />
          </CardContent>
        </Card>
      )}

      {/* Invoice Preview Dialog */}
      <Dialog open={showInvoicePreview} onOpenChange={setShowInvoicePreview}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
          </DialogHeader>
          {invoiceData && selectedClientId && (
            <InvoicePreview 
              reportData={invoiceData} 
              clientId={selectedClientId}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
