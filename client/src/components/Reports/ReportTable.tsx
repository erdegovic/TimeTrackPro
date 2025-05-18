import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Download, File } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/pdf-generator";
import { formatTime, adjustTime, roundTime, formatCurrency } from "@/lib/utils/timeUtils";
import { ReportFilters, Client, TimeEntry, Project, TimeFormat, RoundingType } from "@shared/schema";

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

  const exportReport = () => {
    if (!reportData) return;

    const filename = `timetrackpro-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    generatePdf({
      filename,
      reportData,
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
                      {filters.clientId && weekData.entries[0]?.client?.currency
                        ? formatCurrency(weekData.totalAmount, weekData.entries[0].client.currency)
                        : `$${weekData.totalAmount.toFixed(2)}`}
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
                        {formatTime(entry.adjustedDuration || entry.duration, filters.timeFormat)}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                        {entry.client?.currency 
                          ? formatCurrency(parseFloat(entry.hourlyRate), entry.client.currency)
                          : `$${parseFloat(entry.hourlyRate).toFixed(2)}`}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                        {entry.client?.currency 
                          ? formatCurrency(parseFloat(entry.amount), entry.client.currency)
                          : `$${parseFloat(entry.amount).toFixed(2)}`}
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
                  {formatTime(reportData.totalHours, filters.timeFormat)}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900"></td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                  ${reportData.totalAmount.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex justify-between">
        <div>
          <Button variant="outline" onClick={exportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
        <div>
          <Button onClick={() => onGenerateInvoice(reportData)}>
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
