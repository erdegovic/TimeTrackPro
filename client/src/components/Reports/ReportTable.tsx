import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Check, Copy, Download, Edit3, File, Loader2, Sparkles, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePdf } from "@/lib/pdf-generator-fixed-new";
import { adjustTime, roundTime, formatCurrency } from "@/lib/utils/timeUtils";
import { ReportFilters, Client, TimeEntry, Project, TimeFormat, RoundingType, Settings } from "@shared/schema";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { getUltimateCapabilities } from "@shared/subscriptions";

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
  const { user } = useAuth();
  const ultimateAccess = getUltimateCapabilities(user?.subscriptionPlan, user?.subscriptionStatus);
  const [isEditing, setIsEditing] = useState(false);
  const [editableReportData, setEditableReportData] = useState<ReportData | null>(null);
  const [reportSummary, setReportSummary] = useState<any>(null);

  // Fetch settings to check if weekly categorization is enabled
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const isWeeklyCategorization = settings?.enableWeeklyCategorization ?? true;

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const getEntryCurrency = (entry: any): string => {
    return entry.currency || entry.client?.currency || (settings as any)?.defaultCurrency || "USD";
  };

  const getGroupCurrency = (entries: any[]): string => {
    const currencies = Array.from(new Set(entries.map(getEntryCurrency).filter(Boolean)));
    return currencies.length === 1 ? currencies[0] : (displayedReportData as any)?.currency || (settings as any)?.defaultCurrency || "USD";
  };

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
      if (
        filters.timeAdjustment?.increaseByPercentage ||
        filters.timeAdjustment?.roundToNearestTenth ||
        filters.roundingType !== "none"
      ) {
        return processReportData(structuredData, filters);
      }
      
      return structuredData;
    }
  });

  useEffect(() => {
    setEditableReportData(null);
    setIsEditing(false);
  }, [reportData]);

  const displayedReportData = editableReportData || reportData;

  const projectById = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project]));
  }, [projects]);

  const clientById = useMemo(() => {
    return new Map(clients.map((client) => [client.id, client]));
  }, [clients]);

  const startEditing = () => {
    if (!displayedReportData) return;
    setEditableReportData(cloneReportData(displayedReportData));
    setIsEditing(true);
  };

  const discardEdits = () => {
    setEditableReportData(null);
    setIsEditing(false);
  };

  const finishEditing = () => {
    setIsEditing(false);
  };

  const updateEditedEntry = (
    entryId: number,
    updater: (entry: ReportData["timeEntries"][number]) => ReportData["timeEntries"][number]
  ) => {
    setEditableReportData((current) => {
      if (!current) return current;
      return updateReportEntries(current, entryId, updater);
    });
  };

  const updateEntryField = (
    entry: ReportData["timeEntries"][number],
    updates: Partial<ReportData["timeEntries"][number]>
  ) => {
    updateEditedEntry(entry.id, (currentEntry) => {
      const nextEntry = {
        ...currentEntry,
        ...updates,
      };
      return recalculateEntryAmount(nextEntry);
    });
  };

  const updateEntryProject = (entry: ReportData["timeEntries"][number], projectId: number) => {
    const project = projectById.get(projectId);
    if (!project) return;

    const client = clientById.get(project.clientId);
    updateEntryField(entry, {
      projectId: project.id,
      project,
      client: client || entry.client,
      clientId: project.clientId,
      hourlyRate: project.hourlyRate || entry.hourlyRate,
      currency: (client as any)?.currency || (entry as any).currency,
    } as Partial<ReportData["timeEntries"][number]>);
  };

  
  const exportReport = () => {
    if (!displayedReportData) return;

    const filename = `tickd-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    
    generatePdf({
      filename,
      reportData: displayedReportData,
      filters,
      type: "report"
    });
    
    toast({
      title: "Report exported",
      description: `Your report has been exported as ${filename}`,
    });
  };

  const reportSummaryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ultimate/review", {
        entryIds: displayedReportData?.timeEntries.map((entry) => entry.id) || [],
        mode: "report_summary",
      });
      return response.json();
    },
    onSuccess: setReportSummary,
    onError: (error: Error) => toast({ title: "Summary could not be prepared", description: error.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!displayedReportData || !displayedReportData.timeEntries || displayedReportData.timeEntries.length === 0) {
    return (
      <div className="border border-gray-200 rounded-md p-8 text-center">
        <p className="text-gray-500">No data found for the selected filters.</p>
      </div>
    );
  }

  // Calculate column visibility based on data
  const uniqueClients = new Set(displayedReportData.timeEntries.map(entry => entry.client?.id).filter(Boolean));
  const uniqueProjects = new Set(displayedReportData.timeEntries.map(entry => entry.project?.id).filter(Boolean));
  const uniqueRates = new Set(displayedReportData.timeEntries.map(entry => entry.hourlyRate).filter(rate => rate && rate !== "0"));
  
  const showClientColumn = uniqueClients.size > 1;
  const showProjectColumn = isEditing || uniqueProjects.size > 1;
  const showRateColumn = isEditing || uniqueRates.size > 1;
  const showDateColumn = settings?.showDateColumn ?? true; // Default to true if not set
  
  // Get the single rate if all rates are the same
  const singleRate = uniqueRates.size === 1 ? Array.from(uniqueRates)[0] : null;

  // Calculate column count for colspan calculations
  const visibleColumnCount = [
    showDateColumn, 
    true, // Description always visible
    showClientColumn, 
    showProjectColumn, 
    true, // Hours always visible
    showRateColumn,
    true  // Amount always visible
  ].filter(Boolean).length;

  // Layout helpers for the report table.
  // - Horizontal padding was a flat px-6 on every cell, which alone added ~96px per column and
  //   pushed a 7-column report to 1200-2000px. It now scales with the viewport.
  // - The first visible column is pinned while the user scrolls right, so the row stays
  //   identifiable. It is released at lg where the table fits without scrolling.
  const cellX = "px-3 sm:px-4 lg:px-6";
  const stickyCol = "sticky left-0 z-10 lg:static";
  const dateIsFirstColumn = showDateColumn;

  return (
    <>
      <div className="border border-gray-200 rounded-md overflow-hidden mb-6">
        <div className="bg-gray-50 px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div>
            <span>Report Preview</span>
            {editableReportData && !isEditing && (
              <span className="ml-2 text-xs font-normal text-gray-500">Edited</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={discardEdits}>
                  <X className="mr-2 h-4 w-4" />
                  Discard
                </Button>
                <Button size="sm" onClick={finishEditing}>
                  <Check className="mr-2 h-4 w-4" />
                  Done
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Edit3 className="mr-2 h-4 w-4" />
                Edit Report
              </Button>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {showDateColumn && (
                  <th scope="col" className={`${cellX} ${stickyCol} bg-gray-50 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap`}>Date</th>
                )}
                <th scope="col" className={`${cellX} ${dateIsFirstColumn ? "" : `${stickyCol} bg-gray-50`} py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>Description</th>
                {showClientColumn && (
                  <th scope="col" className={`${cellX} py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>Client</th>
                )}
                {showProjectColumn && (
                  <th scope="col" className={`${cellX} py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>Project</th>
                )}
                <th scope="col" className={`${cellX} py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>Hours</th>
                {showRateColumn && (
                  <th scope="col" className={`${cellX} py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>Rate</th>
                )}
                <th scope="col" className={`${cellX} py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isWeeklyCategorization ? (
                // Show weekly grouped view
                displayedReportData.weeklyData.flatMap((weekData) => {
                  const weekRows = [];
                  
                  // Week header row
                  weekRows.push(
                    <tr key={`week-header-${weekData.weekNumber}-${weekData.weekLabel}`} className="bg-gray-50 font-semibold">
                      {/* Deliberately not sticky: this cell spans nearly the whole row, so pinning
                          it would paint over the amount column while scrolled right. */}
                      <td colSpan={visibleColumnCount - 1} className={`${cellX} py-2 text-sm text-gray-900`}>
                        {weekData.weekLabel}
                      </td>
                      <td className={`${cellX} py-2 whitespace-nowrap text-sm text-gray-900 text-right`}>
                        {formatCurrency(weekData.totalAmount, getGroupCurrency(weekData.entries))}
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
                    
                    weekRows.push(
                      <tr key={`entry-${entry.id}-${weekData.weekNumber}-${index}`}>
                        {showDateColumn && (
                          <td className={`${cellX} ${stickyCol} bg-white py-3 whitespace-nowrap text-sm text-gray-500`}>
                            {format(new Date(entry.date), "MMM d, yyyy")}
                          </td>
                        )}
                        {/* Description is free text, so it wraps instead of forcing the table wider. */}
                        <td className={`${cellX} ${dateIsFirstColumn ? "" : `${stickyCol} bg-white`} py-3 text-sm text-gray-900 min-w-[8rem] max-w-[16rem] break-words`}>
                          {isEditing ? (
                            <Input
                              value={entry.description}
                              onChange={(event) => updateEntryField(entry, { description: event.target.value })}
                              className="h-8 min-w-48"
                            />
                          ) : (
                            entry.description
                          )}
                        </td>
                        {showClientColumn && (
                          <td className={`${cellX} py-3 text-sm text-gray-500`}>
                            {entry.client?.name || "—"}
                          </td>
                        )}
                        {showProjectColumn && (
                          <td className={`${cellX} py-3 text-sm text-gray-500`}>
                            {isEditing ? (
                              <Select
                                value={entry.projectId?.toString() || ""}
                                onValueChange={(value) => updateEntryProject(entry, Number(value))}
                              >
                                <SelectTrigger className="h-8 min-w-40">
                                  <SelectValue placeholder="Project" />
                                </SelectTrigger>
                                <SelectContent>
                                  {projects.map((project) => (
                                    <SelectItem key={project.id} value={project.id.toString()}>
                                      {project.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span style={{ color: (entry.project as any)?.color || "#6B7280" }}>
                                {entry.project?.name || "—"}
                              </span>
                            )}
                          </td>
                        )}
                        <td className={`${cellX} py-3 whitespace-nowrap text-sm font-mono text-gray-900`}>
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={duration}
                              onChange={(event) => updateEntryField(entry, {
                                duration: event.target.value,
                                adjustedDuration: Number(event.target.value) || 0,
                              } as Partial<ReportData["timeEntries"][number]>)}
                              className="h-8 w-24 font-mono"
                            />
                          ) : (
                            filters.timeFormat === 'decimal'
                              ? `${duration.toFixed(2)}h`
                              : formatDecimalHours(duration)
                          )}
                        </td>
                        {showRateColumn && (
                          <td className={`${cellX} py-3 whitespace-nowrap text-sm text-gray-500`}>
                            {isEditing ? (
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={entry.hourlyRate}
                                onChange={(event) => updateEntryField(entry, { hourlyRate: event.target.value })}
                                className="h-8 w-28"
                              />
                            ) : (
                              formatCurrency(parseFloat(String(entry.hourlyRate) || '0'), getEntryCurrency(entry))
                            )}
                          </td>
                        )}
                        <td className={`${cellX} py-3 whitespace-nowrap text-sm text-gray-900`}>
                          {formatCurrency(parseFloat(String(entry.amount) || '0'), getEntryCurrency(entry))}
                        </td>
                      </tr>
                    );
                  });
                  
                  return weekRows;
                })
              ) : (
                // Show flat list without weekly grouping - use grouped entries from weeklyData
                displayedReportData.weeklyData.flatMap(weekData => weekData.entries).map((entry, index) => {
                  const duration = typeof entry.adjustedDuration === 'number' 
                    ? entry.adjustedDuration 
                    : typeof entry.duration === 'number' 
                      ? entry.duration 
                      : parseFloat(String(entry.duration) || '0');
                  return (
                    <tr key={`entry-${entry.id}-${index}`}>
                      {showDateColumn && (
                        <td className={`${cellX} ${stickyCol} bg-white py-3 whitespace-nowrap text-sm text-gray-500`}>
                          {format(new Date(entry.date), "MMM d, yyyy")}
                        </td>
                      )}
                      {/* Description is free text, so it wraps instead of forcing the table wider. */}
                      <td className={`${cellX} ${dateIsFirstColumn ? "" : `${stickyCol} bg-white`} py-3 text-sm text-gray-900 min-w-[8rem] max-w-[16rem] break-words`}>
                        {isEditing ? (
                          <Input
                            value={entry.description}
                            onChange={(event) => updateEntryField(entry, { description: event.target.value })}
                            className="h-8 min-w-48"
                          />
                        ) : (
                          entry.description
                        )}
                      </td>
                      {showClientColumn && (
                        <td className={`${cellX} py-3 text-sm text-gray-500`}>
                          {entry.client?.name || "—"}
                        </td>
                      )}
                      {showProjectColumn && (
                        <td className={`${cellX} py-3 text-sm text-gray-500`}>
                          {isEditing ? (
                            <Select
                              value={entry.projectId?.toString() || ""}
                              onValueChange={(value) => updateEntryProject(entry, Number(value))}
                            >
                              <SelectTrigger className="h-8 min-w-40">
                                <SelectValue placeholder="Project" />
                              </SelectTrigger>
                              <SelectContent>
                                {projects.map((project) => (
                                  <SelectItem key={project.id} value={project.id.toString()}>
                                    {project.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span style={{ color: (entry.project as any)?.color || "#6B7280" }}>
                              {entry.project?.name || "—"}
                            </span>
                          )}
                        </td>
                      )}
                      <td className={`${cellX} py-3 whitespace-nowrap text-sm font-mono text-gray-900`}>
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={duration}
                            onChange={(event) => updateEntryField(entry, {
                              duration: event.target.value,
                              adjustedDuration: Number(event.target.value) || 0,
                            } as Partial<ReportData["timeEntries"][number]>)}
                            className="h-8 w-24 font-mono"
                          />
                        ) : (
                          filters.timeFormat === 'decimal'
                            ? `${duration.toFixed(2)}h`
                            : formatDecimalHours(duration)
                        )}
                      </td>
                      {showRateColumn && (
                        <td className={`${cellX} py-3 whitespace-nowrap text-sm text-gray-500`}>
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={entry.hourlyRate}
                              onChange={(event) => updateEntryField(entry, { hourlyRate: event.target.value })}
                              className="h-8 w-28"
                            />
                          ) : (
                            formatCurrency(parseFloat(String(entry.hourlyRate) || '0'), getEntryCurrency(entry))
                          )}
                        </td>
                      )}
                      <td className={`${cellX} py-3 whitespace-nowrap text-sm text-gray-900`}>
                        {formatCurrency(parseFloat(String(entry.amount) || '0'), getEntryCurrency(entry))}
                      </td>
                    </tr>
                  );
                })
              )}
              
              <tr className="bg-gray-100 font-semibold">
                <td colSpan={visibleColumnCount - 1} className={`${cellX} py-3 whitespace-nowrap text-sm text-gray-900`}>
                  <div className="flex justify-between items-center gap-4">
                    <span>Total</span>
                    <span className="font-mono">
                      {(() => {
                        const totalHours = typeof displayedReportData.totalHours === 'number'
                          ? displayedReportData.totalHours
                          : parseFloat(String(displayedReportData.totalHours) || '0');
                        
                        return filters.timeFormat === 'decimal' 
                          ? `${totalHours.toFixed(2)}h`
                          : formatDecimalHours(totalHours);
                      })()}
                    </span>
                  </div>
                </td>
                <td className={`${cellX} py-3 whitespace-nowrap text-sm text-gray-900`}>
                  {formatCurrency(displayedReportData.totalAmount, (displayedReportData as any).currency || getGroupCurrency(displayedReportData.timeEntries))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Display single rate when all rates are the same */}
        {!showRateColumn && singleRate && parseFloat(singleRate) > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            <strong>Hourly Rate:</strong> {formatCurrency(parseFloat(singleRate), (displayedReportData as any).currency || getGroupCurrency(displayedReportData.timeEntries))} per hour
          </div>
        )}
      </div>
      

      
      {/* These three buttons need ~360px side by side but only ~342px is available at 390px.
          They now stack full width below sm and wrap instead of overflowing above it. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" className="w-full sm:w-auto" onClick={exportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          {ultimateAccess.canUseAi && (
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => reportSummaryMutation.mutate()} disabled={reportSummaryMutation.isPending}>
              {reportSummaryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Write client summary
            </Button>
          )}
        </div>
        <div className="flex">
          <Button className="w-full sm:w-auto" onClick={() => {
            // Pass report data to invoice generator
            onGenerateInvoice(displayedReportData);
          }}>
            <File className="mr-2 h-4 w-4" />
            Generate Invoice
          </Button>
        </div>
      </div>
      <Dialog open={Boolean(reportSummary)} onOpenChange={(open) => !open && setReportSummary(null)}>
        {/* max-w-2xl only caps the desktop width; the base DialogContent supplies
            w-[calc(100vw-2rem)] + max-h + scroll, so this fits at 320/390px. */}
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{reportSummary?.headline || "Client-ready summary"}</DialogTitle>
            <DialogDescription>Prepared only from the entries in this report. Review it before sharing.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 whitespace-pre-wrap">
            {reportSummary?.clientReadySummary}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(reportSummary?.clientReadySummary || "").then(() => toast({ title: "Summary copied" }))}>
              <Copy className="mr-2 h-4 w-4" />Copy summary
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function cloneReportData(data: ReportData): ReportData {
  return {
    ...data,
    timeEntries: data.timeEntries.map((entry) => ({ ...entry })),
    weeklyData: data.weeklyData.map((weekData) => ({
      ...weekData,
      entries: weekData.entries.map((entry) => ({ ...entry })),
    })),
  };
}

function getEntryDuration(entry: ReportData["timeEntries"][number]): number {
  if (typeof entry.adjustedDuration === "number") return entry.adjustedDuration;
  if (typeof entry.duration === "number") return entry.duration;
  return parseFloat(String(entry.duration) || "0") || 0;
}

function recalculateEntryAmount(
  entry: ReportData["timeEntries"][number]
): ReportData["timeEntries"][number] {
  const duration = getEntryDuration(entry);
  const hourlyRate = parseFloat(String(entry.hourlyRate) || "0") || 0;

  return {
    ...entry,
    adjustedDuration: duration,
    amount: (duration * hourlyRate).toFixed(2),
  };
}

function updateReportEntries(
  data: ReportData,
  entryId: number,
  updater: (entry: ReportData["timeEntries"][number]) => ReportData["timeEntries"][number]
): ReportData {
  const weeklyData = data.weeklyData.map((weekData) => {
    const entries = weekData.entries.map((entry) =>
      entry.id === entryId ? updater(entry) : entry
    );

    return recalculateWeekData({
      ...weekData,
      entries,
    });
  });

  const timeEntries = weeklyData.flatMap((weekData) => weekData.entries);

  return {
    ...data,
    weeklyData,
    timeEntries,
    totalHours: weeklyData.reduce((sum, weekData) => sum + weekData.totalHours, 0),
    totalAmount: weeklyData.reduce((sum, weekData) => sum + weekData.totalAmount, 0),
  };
}

function recalculateWeekData(weekData: WeeklyData): WeeklyData {
  const totalHours = weekData.entries.reduce(
    (sum, entry) => sum + getEntryDuration(entry),
    0
  );
  const totalAmount = weekData.entries.reduce(
    (sum, entry) => sum + (parseFloat(String(entry.amount) || "0") || 0),
    0
  );

  return {
    ...weekData,
    totalHours,
    totalAmount,
  };
}

// Process report data with time adjustments and rounding
function processReportData(data: ReportData, filters: ReportFilters): ReportData {
  const { timeAdjustment, roundingType } = filters;

  const adjustEntry = (entry: ReportData["timeEntries"][number]) => {
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
  };
  
  // Recalculate weekly data
  const weeklyData = data.weeklyData.map(weekData => {
    const entries = weekData.entries.map(adjustEntry);
    
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

  const processedEntries = weeklyData.flatMap(weekData => weekData.entries);
  
  // Recalculate totals
  const totalHours = weeklyData.reduce((sum, weekData) => sum + weekData.totalHours, 0);
  
  const totalAmount = weeklyData.reduce((sum, weekData) => sum + weekData.totalAmount, 0);
  
  return {
    ...data,
    timeEntries: processedEntries,
    weeklyData,
    totalHours,
    totalAmount
  };
}
