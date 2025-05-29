import { useState } from "react";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TimeEntry, Client, Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCreativitySidebar } from "@/components/layouts/AppLayout";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { useToast } from "@/hooks/use-toast";
import { CurrencySelector } from "@/components/ui/CurrencySelector";
import CleanTimeEntry from "./CleanTimeEntry";

export default function TimeEntryList() {
  const { toast } = useToast();
  const { isCollapsed: creativitySidebarCollapsed } = useCreativitySidebar();
  const { 
    startTimerWithData, 
    setDescription, 
    setSelectedClientId, 
    setSelectedProjectId,
    isTracking,
    stopTimer 
  } = useTimeTracker();
  const [timeFormat, setTimeFormat] = useState<"decimal" | "time">("time");
  const [groupBy, setGroupBy] = useState<"date" | "project" | "client">("date");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateSelectionState, setDateSelectionState] = useState<"none" | "start" | "complete">("none");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Fetch time entries
  const { data: timeEntries = [], isLoading: isLoadingEntries } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries"],
    staleTime: 0,
  });

  // Fetch clients
  const { data: clients = [], isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch settings for currency information
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const isDataLoading = isLoadingEntries || isLoadingClients || isLoadingProjects;

  // Enhanced entries with client and project data
  const enhancedEntries = timeEntries
    .filter(entry => {
      if (!startDate && !endDate) return true;
      if (startDate && !endDate) return entry.date >= startDate;
      if (!startDate && endDate) return entry.date <= endDate;
      return entry.date >= startDate && entry.date <= endDate;
    })
    .map(entry => {
      const project = projects.find(p => p.id === entry.projectId);
      const client = project ? clients.find(c => c.id === project.clientId) : undefined;
      const duration = Number(entry.duration || 0);
      
      return { 
        ...entry, 
        project, 
        client, 
        exactDuration: duration 
      };
    });

  // Group entries by date
  const dateGroups = enhancedEntries.reduce((acc, entry) => {
    const dateKey = entry.date;
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(entry);
    return acc;
  }, {} as Record<string, typeof enhancedEntries>);

  // Group entries by date, project, or client for display grouping
  const groupedEntries = Object.entries(dateGroups).reduce((acc, [date, entries]) => {
    entries.forEach(entry => {
      let groupKey = "";
      let groupLabel = "";
      
      if (groupBy === "date") {
        groupKey = date;
        
        // Format date for display
        const entryDate = new Date(date);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (format(entryDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) {
          groupLabel = "Today";
        } else if (format(entryDate, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd")) {
          groupLabel = "Yesterday";
        } else {
          groupLabel = format(entryDate, "MMMM d, yyyy");
        }
      } else if (groupBy === "project") {
        groupKey = (entry.projectId || "unknown").toString();
        groupLabel = entry.project?.name || "Unknown Project";
      } else if (groupBy === "client") {
        groupKey = (entry.project?.clientId || "unknown").toString();
        groupLabel = entry.client?.name || "Unknown Client";
      }
      
      if (!acc[groupKey]) {
        acc[groupKey] = { label: groupLabel, entries: [], totalHours: 0 };
      }
      acc[groupKey].entries.push(entry);
      acc[groupKey].totalHours += entry.exactDuration;
    });
    return acc;
  }, {} as Record<string, { label: string; entries: typeof enhancedEntries; totalHours: number }>);

  // Calculate daily earnings with currency conversion
  const calculateDailyEarnings = (entries: typeof enhancedEntries) => {
    const currency = (settings as any)?.defaultCurrency || "USD";
    
    return entries.reduce((total, entry) => {
      if (!entry.project?.hourlyRate || !entry.exactDuration) return total;
      
      const rate = Number(entry.project.hourlyRate);
      const earnings = entry.exactDuration * rate;
      
      return total + earnings;
    }, 0);
  };

  // Sort groups by date (newest first)
  const sortedGroups = Object.entries(groupedEntries).sort((a, b) => {
    if (groupBy === "date") {
      return new Date(b[0]).getTime() - new Date(a[0]).getTime();
    }
    return a[1].label.localeCompare(b[1].label);
  });

  // Delete mutation
  const deleteEntry = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/time-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({
        title: "Time entry deleted",
        description: "Your time entry has been deleted successfully.",
      });
      setDeleteId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the time entry. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Handle delete confirmation
  const confirmDelete = () => {
    if (deleteId !== null) {
      deleteEntry.mutate(deleteId);
    }
  };

  // Handle play button click
  const handlePlay = (description: string, projectId: number) => {
    const project = projects.find(p => p.id === projectId);
    const clientId = project?.clientId;

    setDescription(description);
    setSelectedProjectId(projectId);
    if (clientId) {
      setSelectedClientId(clientId);
    }
    
    startTimerWithData(description, projectId, clientId);
  };

  // Handle currency change
  const handleCurrencyChange = async (currency: string) => {
    try {
      await apiRequest("PUT", "/api/settings", {
        defaultCurrency: currency
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    } catch (error) {
      console.error("Failed to update currency:", error);
    }
  };

  const formatTimeFromDecimal = (decimalHours: number): string => {
    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="space-y-4">
        {/* Large screens: Everything in one row */}
        <div className={`${creativitySidebarCollapsed ? 'hidden lg:flex' : 'hidden xl:flex'} items-center justify-between`}>
          <div className="flex items-center gap-6">
            <div className="flex items-center">
              <label htmlFor="time-format-lg" className="mr-2 text-sm font-medium text-gray-700">Format:</label>
              <Select value={timeFormat} onValueChange={(val: "decimal" | "time") => setTimeFormat(val)}>
                <SelectTrigger id="time-format-lg" className="w-32">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Time</SelectItem>
                  <SelectItem value="decimal">Decimal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center">
              <label htmlFor="group-by-lg" className="mr-2 text-sm font-medium text-gray-700">Group by:</label>
              <Select value={groupBy} onValueChange={(val: "date" | "project" | "client") => setGroupBy(val)}>
                <SelectTrigger id="group-by-lg" className="w-32">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Date Range:</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm h-auto min-w-[200px] justify-start"
                >
                  <Calendar className="w-4 h-4" />
                  {startDate && endDate ? (
                    `${format(new Date(startDate), "MMM d")} - ${format(new Date(endDate), "MMM d, yyyy")}`
                  ) : startDate ? (
                    `${format(new Date(startDate), "MMM d, yyyy")} - Select end`
                  ) : (
                    "Select date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={undefined}
                  onSelect={(date) => {
                    if (!date) return;
                    
                    const clickedDate = format(date, "yyyy-MM-dd");
                    
                    if (dateSelectionState === "none") {
                      setStartDate(clickedDate);
                      setEndDate("");
                      setDateSelectionState("start");
                    } else if (dateSelectionState === "start") {
                      if (clickedDate === startDate) {
                        setStartDate("");
                        setEndDate("");
                        setDateSelectionState("none");
                      } else {
                        if (new Date(clickedDate) < new Date(startDate)) {
                          setStartDate(clickedDate);
                          setEndDate(startDate);
                        } else {
                          setEndDate(clickedDate);
                        }
                        setDateSelectionState("complete");
                      }
                    } else {
                      setStartDate(clickedDate);
                      setEndDate("");
                      setDateSelectionState("start");
                    }
                  }}
                  numberOfMonths={2}
                  initialFocus
                  modifiers={{
                    selectedStart: (date) => {
                      if (!startDate) return false;
                      return format(date, "yyyy-MM-dd") === startDate;
                    },
                    selectedEnd: (date) => {
                      if (!endDate) return false;
                      return format(date, "yyyy-MM-dd") === endDate;
                    },
                    selectedRange: (date) => {
                      if (!startDate || !endDate) return false;
                      const dateStr = format(date, "yyyy-MM-dd");
                      return dateStr > startDate && dateStr < endDate;
                    }
                  }}
                  modifiersClassNames={{
                    selectedStart: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    selectedEnd: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    selectedRange: "bg-primary/20 hover:bg-primary/30"
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Small screens: Stack vertically */}
        <div className={`${creativitySidebarCollapsed ? 'lg:hidden' : 'xl:hidden'} space-y-3`}>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Format & Grouping:</label>
            <div className="flex items-center gap-2">
              <Select value={timeFormat} onValueChange={(val: "decimal" | "time") => setTimeFormat(val)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Time</SelectItem>
                  <SelectItem value="decimal">Decimal</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupBy} onValueChange={(val: "date" | "project" | "client") => setGroupBy(val)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Date Range:</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-1 px-3 py-1.5 text-sm h-auto justify-start"
                >
                  <Calendar className="w-4 h-4" />
                  {startDate && endDate ? (
                    `${format(new Date(startDate), "MMM d")} - ${format(new Date(endDate), "MMM d, yyyy")}`
                  ) : startDate ? (
                    `${format(new Date(startDate), "MMM d, yyyy")} - Select end`
                  ) : (
                    "Select date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={undefined}
                  onSelect={(date) => {
                    if (!date) return;
                    
                    const clickedDate = format(date, "yyyy-MM-dd");
                    
                    if (dateSelectionState === "none") {
                      setStartDate(clickedDate);
                      setEndDate("");
                      setDateSelectionState("start");
                    } else if (dateSelectionState === "start") {
                      if (clickedDate === startDate) {
                        setStartDate("");
                        setEndDate("");
                        setDateSelectionState("none");
                      } else {
                        if (new Date(clickedDate) < new Date(startDate)) {
                          setStartDate(clickedDate);
                          setEndDate(startDate);
                        } else {
                          setEndDate(clickedDate);
                        }
                        setDateSelectionState("complete");
                      }
                    } else {
                      setStartDate(clickedDate);
                      setEndDate("");
                      setDateSelectionState("start");
                    }
                  }}
                  numberOfMonths={1}
                  initialFocus
                  modifiers={{
                    selectedStart: (date) => {
                      if (!startDate) return false;
                      return format(date, "yyyy-MM-dd") === startDate;
                    },
                    selectedEnd: (date) => {
                      if (!endDate) return false;
                      return format(date, "yyyy-MM-dd") === endDate;
                    },
                    selectedRange: (date) => {
                      if (!startDate || !endDate) return false;
                      const dateStr = format(date, "yyyy-MM-dd");
                      return dateStr > startDate && dateStr < endDate;
                    }
                  }}
                  modifiersClassNames={{
                    selectedStart: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    selectedEnd: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    selectedRange: "bg-primary/20 hover:bg-primary/30"
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
      
      {/* Time Entries */}
      {isDataLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : sortedGroups.length === 0 ? (
        <div className="tickd-card tickd-spacing-xl text-center">
          <p className="text-gray-500">No time entries found. Start tracking your time!</p>
        </div>
      ) : (
        sortedGroups.map(([groupKey, group]) => (
          <div key={groupKey} className="tickd-card mb-6">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">{group.label}</h2>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-500">
                    Total: {timeFormat === "decimal" ? group.totalHours.toFixed(1) + "h" : formatTimeFromDecimal(group.totalHours)}
                  </span>
                  {groupBy === "date" && (() => {
                    const dailyEarnings = calculateDailyEarnings(group.entries);
                    const currency = (settings as any)?.defaultCurrency || "USD";
                    return dailyEarnings > 0 ? (
                      <div className="flex items-center gap-1">
                        <CurrencySelector
                          selectedCurrency={currency}
                          onCurrencyChange={handleCurrencyChange}
                        />
                        <span className="text-sm font-medium text-green-600">
                          {dailyEarnings.toFixed(2)}
                        </span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>
            
            {/* Clean Time Entry List - Mobile Responsive */}
            <div className="bg-white">
              {group.entries.map((entry) => {
                // Transform entry to match CleanTimeEntry interface
                const groupedEntry = {
                  id: entry.id,
                  description: entry.description,
                  project: entry.project,
                  client: entry.client,
                  blocks: [{
                    id: entry.id.toString(),
                    startTime: entry.startTime,
                    endTime: entry.endTime || new Date(),
                    duration: Number(entry.duration || 0)
                  }],
                  totalDuration: Number(entry.duration || 0),
                  date: entry.date,
                  isExpanded: false
                };

                return (
                  <CleanTimeEntry
                    key={`entry-${entry.id}`}
                    entry={groupedEntry}
                    clients={clients}
                    projects={projects}
                    timeFormat={timeFormat}
                    onDelete={(id) => setDeleteId(id)}
                    onPlay={handlePlay}
                    isTracking={isTracking}
                    onStop={stopTimer}
                    isGrouped={false}
                  />
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this time entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}