import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Download, File } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/pdf-generator-fixed-new";
import { formatTime, adjustTime, roundTime, formatCurrency } from "@/lib/utils/timeUtils";
import { ReportFilters, Client, TimeEntry, Project, TimeFormat, RoundingType } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReportTableProps {
  filters: ReportFilters;
  onGenerateInvoice: (reportData: any) => void;
}

interface WeeklyData {
  weekNumber: number;
  weekLabel: string;
  entries: (TimeEntry & { 
    client?: Client; 
    project?: Project;
    hourlyRate: string;
    amount: string;
    adjustedDuration?: number;
  })[];
  totalHours: number;
  totalAmount: number;
}

interface ReportData {
  timeEntries: (TimeEntry & { 
    client?: Client; 
    project?: Project;
    hourlyRate: string;
    amount: string;
    adjustedDuration?: number;
  })[];
  weeklyData: WeeklyData[];
  totalHours: number;
  totalAmount: number;
  timeFormat: TimeFormat;
  roundingType: RoundingType;
}

export default function ReportTable({ filters, onGenerateInvoice }: ReportTableProps) {
  const { toast } = useToast();
  
  // Fetch report data
  const { data: reportData, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports", filters],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/reports", filters);
      const data = await res.json();
      
      // Apply time adjustments and rounding if needed
      if (filters.timeAdjustment?.increaseByPercentage || filters.roundingType !== "none") {
        return processReportData(data, filters);
      }
      
      return data;
    }
  });

  // Add state for report notes
  const [reportNotes, setReportNotes] = useState<string>("");
  
  const exportReport = () => {
    if (!reportData) return;

    const filename = `timetrackpro-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    
    // Add notes to report data for PDF
    const reportDataWithNotes = {
      ...reportData,
      notes: reportNotes // Include notes in the report data
    };
    
    generatePdf({
      filename,
      reportData: reportDataWithNotes,
      filters,
      type: "report"
    });
    
    toast({
      title: "Report exported",
      description: `Your report has been exported as ${filename}`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!reportData || reportData.timeEntries.length === 0) {
    return (
      <div className="border border-gray-200 rounded-md p-8 text-center">
        <p className="text-gray-500">No data found for the selected filters.</p>
      </div>
    );
  }

  return (
    <>
      <div className="border border-gray-200 rounded-md overflow-hidden mb-6">
        <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 border-b border-gray-200">
          Report Preview
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Week</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.weeklyData.map((weekData) => (
                <>
                  <tr key={`week-${weekData.weekNumber}`} className="bg-gray-50 font-semibold">
                    <td colSpan={7} className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      {weekData.weekLabel}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(weekData.totalAmount, 
                        filters.clientId && reportData.timeEntries[0]?.client?.currency || 'USD')}
                    </td>
                  </tr>
                  
                  {weekData.entries.map((entry, index) => (
                    <tr key={`entry-${entry.id}-${index}`}>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                        Week {weekData.weekNumber}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(entry.date), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                        {entry.description}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                        {entry.client?.name || "—"}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                        {entry.project?.name || "—"}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                        {formatTime(
                          typeof entry.adjustedDuration === 'number' 
                            ? entry.adjustedDuration 
                            : typeof entry.duration === 'number' 
                              ? entry.duration 
                              : parseFloat(entry.duration || '0'), 
                          filters.timeFormat
                        )}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(parseFloat(entry.hourlyRate), 
                          filters.clientId && reportData.timeEntries[0]?.client?.currency || 'USD')}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(parseFloat(entry.amount), 
                          filters.clientId && reportData.timeEntries[0]?.client?.currency || 'USD')}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
              
              <tr className="bg-gray-100 font-semibold">
                <td colSpan={5} className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                  Total
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                  {formatTime(
                    typeof reportData.totalHours === 'number' 
                      ? reportData.totalHours 
                      : parseFloat(String(reportData.totalHours) || '0'), 
                    filters.timeFormat
                  )}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900"></td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                  {filters.clientId && reportData.timeEntries[0]?.client?.currency
                    ? formatCurrency(reportData.totalAmount, reportData.timeEntries[0].client.currency)
                    : `$${reportData.totalAmount.toFixed(2)}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Notes section */}
      <div className="mb-6">
        <Label htmlFor="report-notes" className="block text-sm font-medium mb-2">
          Notes for PDF Export
        </Label>
        <Textarea 
          id="report-notes"
          value={reportNotes}
          onChange={(e) => setReportNotes(e.target.value)}
          placeholder="Add notes that will appear in the exported PDF"
          className="w-full min-h-[100px]"
        />
      </div>
      
      <div className="flex justify-between">
        <div>
          <Button variant="outline" onClick={exportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
        <div>
          <Button onClick={() => {
            // Pass report data with notes to invoice generator
            onGenerateInvoice({
              ...reportData,
              notes: reportNotes
            });
          }}>
            <File className="mr-2 h-4 w-4" />
            Generate Invoice
          </Button>
        </div>
      </div>
    </>
  );
}

// Process report data with time adjustments and rounding
function processReportData(data: ReportData, filters: ReportFilters): ReportData {
  const { timeAdjustment, roundingType } = filters;
  
  // Process time entries
  const processedEntries = data.timeEntries.map(entry => {
    let duration = Number(entry.duration);
    
    // Apply percentage increase if needed
    if (timeAdjustment?.increaseByPercentage) {
      duration = adjustTime(duration, timeAdjustment.percentage);
    }
    
    // Apply rounding if needed
    if (roundingType !== "none" || timeAdjustment?.roundToNearestTenth) {
      duration = roundTime(
        duration, 
        timeAdjustment?.roundToNearestTenth ? "nearest_tenth" : roundingType
      );
    }
    
    // Calculate adjusted amount
    const hourlyRate = parseFloat(entry.hourlyRate);
    const amount = (duration * hourlyRate).toFixed(2);
    
    return {
      ...entry,
      adjustedDuration: duration,
      amount
    };
  });
  
  // Recalculate weekly data
  const weeklyData = data.weeklyData.map(weekData => {
    const entries = processedEntries.filter(
      entry => entry.weekNumber === weekData.weekNumber
    );
    
    const totalHours = entries.reduce(
      (sum, entry) => sum + (entry.adjustedDuration || Number(entry.duration)), 
      0
    );
    
    const totalAmount = entries.reduce(
      (sum, entry) => sum + parseFloat(entry.amount), 
      0
    );
    
    return {
      ...weekData,
      entries,
      totalHours,
      totalAmount
    };
  });
  
  // Recalculate totals
  const totalHours = processedEntries.reduce(
    (sum, entry) => sum + (entry.adjustedDuration || Number(entry.duration)), 
    0
  );
  
  const totalAmount = processedEntries.reduce(
    (sum, entry) => sum + parseFloat(entry.amount), 
    0
  );
  
  return {
    ...data,
    timeEntries: processedEntries,
    weeklyData,
    totalHours,
    totalAmount
  };
}
