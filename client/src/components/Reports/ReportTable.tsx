import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Download, File } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/pdf-generator-fixed-new";
import { formatTime, formatTimeFromDecimal, adjustTime, roundTime, formatCurrency } from "@/lib/utils/timeUtils";
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

  // Fetch settings to check if weekly categorization is enabled
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const isWeeklyCategorization = settings?.enableWeeklyCategorization ?? true;

  // Helper function to format decimal hours to HH:MM:SS
  const formatDecimalHours = (decimalHours: number): string => {
    const totalSeconds = Math.round(decimalHours * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Fetch report data
  const { data: reportData, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports", filters],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/reports", filters);
      const data = await res.json();
      
      // Handle both old array format and new structured format
      let structuredData;
      if (Array.isArray(data)) {
        // Convert old array format to new structured format and group by weeks
        const groupedByWeek = data.reduce((acc: any, entry: any) => {
          const weekKey = entry.weekLabel || `Week ${entry.weekNumber}`;
          if (!acc[weekKey]) {
            acc[weekKey] = {
              weekNumber: entry.weekNumber || 1,
              weekLabel: weekKey,
              totalHours: 0,
              totalAmount: 0,
              entries: []
            };
          }
          acc[weekKey].entries.push(entry);
          acc[weekKey].totalHours += parseFloat(entry.duration) || 0;
          acc[weekKey].totalAmount += parseFloat(entry.amount) || 0;
          return acc;
        }, {});

        structuredData = {
          timeEntries: data,
          weeklyData: Object.values(groupedByWeek),
          totalHours: data.reduce((sum: number, entry: any) => sum + (parseFloat(entry.duration) || 0), 0),
          totalAmount: data.reduce((sum: number, entry: any) => sum + (parseFloat(entry.amount) || 0), 0),
          timeFormat: filters.timeFormat || "decimal",
          roundingType: filters.roundingType || "none"
        };
      } else {
        // Already in structured format
        structuredData = data;
      }
      
      // Apply time adjustments and rounding if needed
      if (filters.timeAdjustment?.increaseByPercentage || filters.roundingType !== "none") {
        return processReportData(structuredData, filters);
      }
      
      return structuredData;
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

  if (!reportData || !reportData.timeEntries || reportData.timeEntries.length === 0) {
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
                {isWeeklyCategorization && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Week</th>
                )}
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
              {isWeeklyCategorization ? (
                // Show weekly grouped view
                reportData.weeklyData.flatMap((weekData) => {
                  const weekRows = [];
                  
                  // Week header row
                  weekRows.push(
                    <tr key={`week-header-${weekData.weekNumber}-${weekData.weekLabel}`} className="bg-gray-50 font-semibold">
                      <td colSpan={isWeeklyCategorization ? 7 : 6} className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                        {weekData.weekLabel}
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(weekData.totalAmount, 
                          filters.clientId && reportData.timeEntries[0]?.client?.currency || 'USD')}
                      </td>
                    </tr>
                  );
                  
                  // Entry rows for this week
                  weekData.entries.forEach((entry, index) => {
                    const duration = typeof entry.adjustedDuration === 'number' 
                      ? entry.adjustedDuration 
                      : typeof entry.duration === 'number' 
                        ? entry.duration 
                        : parseFloat(String(entry.duration) || '0');
                    
                    console.log(`[ReportTable] Entry ${entry.id}: duration=${entry.duration}, adjustedDuration=${entry.adjustedDuration}, calculated=${duration}`);
                    
                    weekRows.push(
                      <tr key={`entry-${entry.id}-${weekData.weekNumber}-${index}`}>
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
                          <span style={{ color: (entry.project as any)?.color || "#6B7280" }}>
                            {entry.project?.name || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                          {filters.timeFormat === 'decimal' 
                            ? `${duration.toFixed(2)}h`
                            : formatDecimalHours(duration)
                          }
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(parseFloat(String(entry.hourlyRate) || '0'), 
                            filters.clientId && reportData.timeEntries[0]?.client?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(parseFloat(String(entry.amount) || '0'), 
                            filters.clientId && reportData.timeEntries[0]?.client?.currency || 'USD')}
                        </td>
                      </tr>
                    );
                  });
                  
                  return weekRows;
                })
              ) : (
                // Show flat list without weekly grouping - use grouped entries from weeklyData
                reportData.weeklyData.flatMap(weekData => weekData.entries).map((entry, index) => {
                  const duration = typeof entry.adjustedDuration === 'number' 
                    ? entry.adjustedDuration 
                    : typeof entry.duration === 'number' 
                      ? entry.duration 
                      : parseFloat(String(entry.duration) || '0');
                  
                  console.log(`[ReportTable] Entry ${entry.id}: duration=${entry.duration}, adjustedDuration=${entry.adjustedDuration}, calculated=${duration}`);
                  
                  return (
                    <tr key={`entry-${entry.id}-${index}`}>
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
                        <span style={{ color: (entry.project as any)?.color || "#6B7280" }}>
                          {entry.project?.name || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                        {filters.timeFormat === 'decimal' 
                          ? `${duration.toFixed(2)}h`
                          : formatDecimalHours(duration)
                        }
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(parseFloat(String(entry.hourlyRate) || '0'), 
                          filters.clientId && reportData.timeEntries[0]?.client?.currency || 'USD')}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(parseFloat(String(entry.amount) || '0'), 
                          filters.clientId && reportData.timeEntries[0]?.client?.currency || 'USD')}
                      </td>
                    </tr>
                  );
                })
              )}
              
              <tr className="bg-gray-100 font-semibold">
                <td colSpan={isWeeklyCategorization ? 5 : 4} className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                  Total
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                  {(() => {
                    const totalHours = typeof reportData.totalHours === 'number' 
                      ? reportData.totalHours 
                      : parseFloat(String(reportData.totalHours) || '0');
                    
                    return filters.timeFormat === 'decimal' 
                      ? `${totalHours.toFixed(2)}h`
                      : formatDecimalHours(totalHours);
                  })()}
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
      

      
      <div className="flex justify-between">
        <div>
          <Button variant="outline" onClick={exportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
        <div>
          <Button onClick={() => {
            // Pass report data to invoice generator
            onGenerateInvoice(reportData);
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
