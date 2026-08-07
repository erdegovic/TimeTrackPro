import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReportFilters from "@/components/Reports/ReportFilters";
import ReportTable from "@/components/Reports/ReportTable";
import InvoicePreview from "@/components/Invoices/InvoicePreview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportFilters as ReportFiltersType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function ReportsPage() {
  const { toast } = useToast();
  const [currentFilters, setCurrentFilters] = useState<ReportFiltersType | null>(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);
  const [isEditing, setIsEditing] = useState(false);

  const handleApplyFilters = (filters: ReportFiltersType) => {
    setCurrentFilters(filters);
  };

  const handleGenerateInvoice = (reportData: any) => {
    if (currentFilters?.clientId) {
      setSelectedClientId(currentFilters.clientId);
      setInvoiceData(reportData);
      setShowInvoicePreview(true);
    } else {
      const clientIds = new Set<number>();
      reportData.timeEntries.forEach((entry: any) => {
        if (entry.client) clientIds.add(entry.client.id);
      });

      if (clientIds.size === 1) {
        setSelectedClientId(Array.from(clientIds)[0]);
        setInvoiceData(reportData);
        setShowInvoicePreview(true);
      } else {
        toast({
          title: "Select a specific client",
          description: "Please filter by a single client before generating an invoice.",
          variant: "destructive",
        });
      }
    }
  };

  const handleInvoicePreviewOpenChange = (open: boolean) => {
    setShowInvoicePreview(open);
    if (!open) setIsEditing(false);
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
          <ReportFilters
            onApplyFilters={handleApplyFilters}
            liveUpdate={!!currentFilters}
          />
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
      <Dialog open={showInvoicePreview} onOpenChange={handleInvoicePreviewOpenChange}>
        {/* Base DialogContent already handles width/height/scroll; only the desktop max width
            is overridden here so the preview does not exceed the viewport at 320-390px. */}
        <DialogContent className="max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
          </DialogHeader>
          {invoiceData && selectedClientId && (
            <InvoicePreview 
              reportData={invoiceData} 
              clientId={selectedClientId}
              onEditInvoice={() => setIsEditing((current) => !current)}
              isEditing={isEditing}

            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
