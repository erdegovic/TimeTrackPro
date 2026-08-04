import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreativitySidebar } from "@/components/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Edit, Copy, Trash2, Play, Calendar, MessageSquare } from "lucide-react";
import { TimeEntry, Client, Project } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTimerContext } from "@/context/TimerContext";
import { useToast } from "@/hooks/use-toast";
import { CurrencySelector } from "@/components/ui/CurrencySelector";
import {
  CustomCurrencyMap,
  convertCurrency,
  fetchCustomCurrencyRates,
  fetchExchangeRates,
  getExchangeRateSymbols,
  saveCustomCurrencyRates,
} from "@/lib/currency-rates";
import TimeEntryRow from "./TimeEntry";
import EnhancedTimeEntry from "./EnhancedTimeEntry";
import { TimeEntryNotes } from "./TimeEntryNotes";

const parseEntryDate = (date: string) => new Date(`${date}T12:00:00`);
const timeEntryCalendarClassNames = { day_today: "text-foreground" };

type MobileEditState = {
  entry: any;
  description: string;
  clientId: string;
  projectId: string;
  duration: string;
};

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
  } = useTimerContext();
  const [timeFormat, setTimeFormat] = useState<"decimal" | "time">("time");
  const [groupBy, setGroupBy] = useState<"date" | "project" | "client">("date");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateSelectionState, setDateSelectionState] = useState<"none" | "start" | "complete">("none");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [newEntryIds, setNewEntryIds] = useState<number[]>([]);
  const [mobileEdit, setMobileEdit] = useState<MobileEditState | null>(null);

  // Fetch time entries
  const { data: timeEntries = [], isLoading: isLoadingEntries, refetch: refetchTimeEntries } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries"],
    staleTime: 0, // Always fetch fresh data
    gcTime: 0   // Don't cache results (renamed from cacheTime in React Query v5)
  });

  // Fetch settings for currency information
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });
  const defaultCurrency = (settings as any)?.defaultCurrency || "USD";
  const { data: customCurrencyData } = useQuery({
    queryKey: ["/api/custom-currency-rates"],
    queryFn: fetchCustomCurrencyRates,
  });
  const customCurrencies = customCurrencyData?.currencies || {};

  // Currency update mutation
  const updateCurrencyMutation = useMutation({
    mutationFn: (newCurrency: string) => 
      apiRequest("PUT", "/api/settings", { defaultCurrency: newCurrency }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Currency updated",
        description: "Default currency has been changed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update currency.",
        variant: "destructive",
      });
    },
  });
  const saveCustomCurrenciesMutation = useMutation({
    mutationFn: (currencies: CustomCurrencyMap) => saveCustomCurrencyRates(currencies),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-currency-rates"] });
      toast({
        title: "Currency rate saved",
        description: "Your custom rate has been saved to your profile.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save currency rate.",
        variant: "destructive",
      });
    },
  });

  const handleCurrencyChange = (newCurrency: string) => {
    updateCurrencyMutation.mutate(newCurrency);
  };

  const handleSaveCustomCurrencies = async (currencies: CustomCurrencyMap) => {
    await saveCustomCurrenciesMutation.mutateAsync(currencies);
  };

  // Listen for timer updates to refresh total times immediately
  useEffect(() => {
    const handleTimeEntryUpdate = () => {
      refetchTimeEntries();
    };

    window.addEventListener('timeEntryUpdated', handleTimeEntryUpdate);
    return () => window.removeEventListener('timeEntryUpdated', handleTimeEntryUpdate);
  }, [refetchTimeEntries]);
  
  // Track new entries for highlighting
  useEffect(() => {
    if (timeEntries.length > 0) {
      // Find the most recently created entry
      const latestEntry = timeEntries.reduce((latest, current) => {
        const latestDate = new Date(latest.endTime || latest.date);
        const currentDate = new Date(current.endTime || current.date);
        return currentDate > latestDate ? current : latest;
      }, timeEntries[0]);
      
      // If the latest entry is new (within last 5 seconds) and not already highlighted
      const now = new Date();
      const entryTime = new Date(latestEntry.endTime || latestEntry.date);
      const isRecent = (now.getTime() - entryTime.getTime()) < 5000; // 5 seconds
      
      if (isRecent && !newEntryIds.includes(latestEntry.id)) {
        setNewEntryIds(prev => [...prev, latestEntry.id]);
      }
    }
  }, [timeEntries]);

  // Listen for manual highlight triggers from timer updates
  useEffect(() => {
    const handleHighlight = (event: CustomEvent) => {
      const { entryId } = event.detail;
      if (entryId && !newEntryIds.includes(entryId)) {
        setNewEntryIds(prev => [...prev, entryId]);
      }
    };

    window.addEventListener('timeEntryHighlight', handleHighlight as EventListener);
    return () => window.removeEventListener('timeEntryHighlight', handleHighlight as EventListener);
  }, [newEntryIds]);
  
  // Effect to remove the highlight after it fades away
  useEffect(() => {
    if (newEntryIds.length > 0) {
      const timer = setTimeout(() => {
        setNewEntryIds([]);
      }, 3000); // Remove highlight after 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, [newEntryIds]);

  // Fetch clients
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Don't process entries until all data is loaded
  const isDataLoading = isLoadingEntries || clientsLoading || projectsLoading;

  // Group entries by description, project, and date for session grouping
  const groupedSessions = useMemo(() => {
    // Don't process if any data is still loading
    if (isDataLoading || !clients.length || !projects.length) {
      return new Map<string, any[]>();
    }

    const sessionGroups = new Map<string, any[]>();
    
    timeEntries.forEach(entry => {
      const project = projects.find(p => p.id === entry.projectId);
      const client = project ? clients.find(c => c.id === project.clientId) : undefined;
      
      // Create a unique key for grouping: description + project + date
      const groupKey = `${entry.description || ''}-${entry.projectId}-${entry.date}`;
      
      if (!sessionGroups.has(groupKey)) {
        sessionGroups.set(groupKey, []);
      }
      
      sessionGroups.get(groupKey)!.push({
        ...entry,
        project,
        client
      });
    });
    
    return sessionGroups;
  }, [timeEntries, projects, clients]);

  // Enhanced time entries with client and project data, filtering by date range
  const enhancedEntries = useMemo(() => {
    // Don't process if any data is still loading
    if (isDataLoading) {
      return [];
    }

    let filteredEntries = timeEntries;
    
    // Apply date range filtering
    if (startDate || endDate) {
      filteredEntries = timeEntries.filter(entry => {
        const entryDate = entry.date;
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        return true;
      });
    }

    return filteredEntries.map(entry => {
      const project = projects.find(p => p.id === entry.projectId);
      const client = project ? clients.find(c => c.id === project.clientId) : undefined;
      
      // ALWAYS use the stored duration field as the source of truth
      // This ensures that manually edited durations are reflected in totals
      const duration = Number(entry.duration || 0);
      
      return { 
        ...entry, 
        project, 
        client, 
        // Store the duration in a consistent field
        exactDuration: duration 
      };
    });
  }, [timeEntries, projects, clients, isDataLoading, startDate, endDate]);

  const exchangeRateSymbols = useMemo(() => {
    return getExchangeRateSymbols([
      defaultCurrency,
      ...enhancedEntries.map((entry: any) => entry.client?.currency),
    ]);
  }, [defaultCurrency, enhancedEntries]);

  const { data: exchangeRatesData } = useQuery({
    queryKey: ["/api/exchange-rates", "USD", exchangeRateSymbols.join(",")],
    queryFn: () => fetchExchangeRates(exchangeRateSymbols, "USD"),
    enabled: exchangeRateSymbols.length > 0,
    staleTime: 60 * 60 * 1000,
  });
  const manualRateCurrencyCodes = exchangeRatesData
    ? exchangeRateSymbols.filter((currency) => !exchangeRatesData.rates[currency] && !customCurrencies[currency])
    : [];

  // First group by date
  const dateGroups = enhancedEntries.reduce((acc, entry) => {
    const dateKey = entry.date;
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(entry);
    return acc;
  }, {} as Record<string, typeof enhancedEntries>);

  // Then within each date, group by project+description for session merging
  const sessionGroupedEntries = Object.entries(dateGroups).map(([date, entries]) => {
    // Group entries by project + description combination
    const sessionGroups = entries.reduce((acc, entry) => {
      const sessionKey = `${entry.projectId}-${entry.description}`;
      if (!acc[sessionKey]) {
        acc[sessionKey] = [];
      }
      acc[sessionKey].push(entry);
      return acc;
    }, {} as Record<string, typeof entries>);

    // Convert session groups to enhanced time entry format
    const processedEntries = Object.values(sessionGroups).map(sessionEntries => {
      if (sessionEntries.length === 1) {
        // Single entry - show as normal
        return sessionEntries[0];
      } else {
        // Multiple entries - create grouped entry with blocks
        const sortedEntries = sessionEntries.sort((a, b) => 
          new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime()
        );
        
        const blocks = sortedEntries.map(entry => ({
          id: entry.id.toString(),
          startTime: new Date(entry.startTime!),
          endTime: new Date(entry.endTime!),
          duration: Number(entry.duration || 0)
        }));

        const totalDuration = blocks.reduce((sum, block) => sum + block.duration, 0);
        const earliestStart = blocks[0].startTime;
        const latestEnd = blocks[blocks.length - 1].endTime;

        return {
          ...sortedEntries[0], // Use first entry as base
          sessionGroup: sessionEntries,
          blocks,
          totalDuration,
          sessionCount: sessionEntries.length,
          overallStartTime: earliestStart,
          overallEndTime: latestEnd,
          exactDuration: totalDuration
        };
      }
    });

    return {
      date,
      entries: processedEntries
    };
  });

  // Group entries by date, project, or client for display grouping
  const groupedEntries = sessionGroupedEntries.reduce((acc, { date, entries }) => {
    entries.forEach(entry => {
      let groupKey = "";
      let groupLabel = "";
      
      if (groupBy === "date") {
        groupKey = date;
        
        // Format date for display
        const entryDate = parseEntryDate(date);
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
        groupKey = entry.projectId?.toString() || "unknown-project";
        groupLabel = entry.project?.name || "Unknown Project";
      } else if (groupBy === "client") {
        groupKey = (entry.project?.clientId || "unknown").toString();
        groupLabel = entry.client?.name || "Unknown Client";
      }
      
      if (!acc[groupKey]) {
        acc[groupKey] = {
          label: groupLabel,
          entries: [],
          totalHours: 0
        };
      }
      
      acc[groupKey].entries.push(entry);
      // Use exactDuration for grouped entries, fall back to duration for single entries
      const entryDuration = entry.exactDuration !== undefined ? entry.exactDuration : Number(entry.duration || 0);
      acc[groupKey].totalHours += entryDuration;
    });
    
    return acc;
  }, {} as Record<string, { label: string; entries: any[]; totalHours: number }>);

  // Sort entries within each group (newest first)
  Object.values(groupedEntries).forEach(group => {
    group.entries.sort((a, b) => {
      // Sort by ID in descending order (newest entries have higher IDs)
      return b.id - a.id;
    });
  });

  // Function to calculate daily earnings with proper currency conversion
  const calculateDailyEarnings = (entries: any[]) => {
    return entries.reduce((total, entry) => {
      const duration = entry.exactDuration !== undefined ? entry.exactDuration : Number(entry.duration || 0);
      
      // Get hourly rate and currency from project or client
      let hourlyRate = 0;
      let projectCurrency = defaultCurrency;
      
      if (entry.project?.hourlyRate) {
        hourlyRate = Number(entry.project.hourlyRate);
        // Projects inherit currency from their client
        projectCurrency = entry.client?.currency || defaultCurrency;
      } else if (entry.client?.hourlyRate) {
        hourlyRate = Number(entry.client.hourlyRate);
        projectCurrency = entry.client?.currency || defaultCurrency;
      }
      
      // Skip entries with no rate
      if (hourlyRate === 0) {
        return total;
      }
      
      // Calculate earnings in project currency
      const projectEarnings = duration * hourlyRate;
      
      // Convert to default display currency
      const convertedEarnings = convertCurrency(projectEarnings, projectCurrency, defaultCurrency, exchangeRatesData?.rates, customCurrencies);
      
      return total + convertedEarnings;
    }, 0);
  };

  // Sort groups by date (newest first)
  const sortedGroups = Object.entries(groupedEntries).sort((a, b) => {
    if (groupBy === "date") {
      return new Date(b[0]).getTime() - new Date(a[0]).getTime();
    }
    return a[1].label.localeCompare(b[1].label);
  });

  const entryShouldHighlight = (entry: any) => {
    if (newEntryIds.includes(entry.id)) return true;
    return entry.sessionGroup?.some((session: TimeEntry) => newEntryIds.includes(session.id)) || false;
  };

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

  const mobileEntryMutation = useMutation({
    mutationFn: async (state: MobileEditState) => {
      const parsedDuration = parseDurationInput(state.duration);
      if (!state.description.trim() || parsedDuration <= 0) {
        throw new Error("Description and duration are required.");
      }

      const sourceEntries: any[] = state.entry.sessionGroup?.length
        ? state.entry.sessionGroup
        : [state.entry];
      const currentTotal = sourceEntries.reduce(
        (total, item) => total + Number(item.duration || 0),
        0,
      );

      for (const item of sourceEntries) {
        const ratio = currentTotal > 0
          ? Number(item.duration || 0) / currentTotal
          : 1 / sourceEntries.length;
        await apiRequest("PUT", `/api/time-entries/${item.id}`, {
          description: state.description.trim(),
          projectId: state.projectId ? Number(state.projectId) : null,
          clientId: state.projectId ? null : (state.clientId ? Number(state.clientId) : null),
          duration: (parsedDuration * ratio).toFixed(6),
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      setMobileEdit(null);
      toast({
        title: "Time entry updated",
        description: "The task details and duration have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to update entry",
        description: error.message || "Please check the entry and try again.",
        variant: "destructive",
      });
    },
  });

  const duplicateEntryMutation = useMutation({
    mutationFn: async (entry: any) => {
      const sourceEntries: any[] = entry.sessionGroup?.length
        ? entry.sessionGroup
        : [entry];
      const totalDuration = sourceEntries.reduce(
        (total, item) => total + Number(item.duration || 0),
        0,
      );
      const starts = sourceEntries.map((item) => new Date(item.startTime).getTime());
      const ends = sourceEntries.map((item) => new Date(item.endTime || item.startTime).getTime());

      await apiRequest("POST", "/api/time-entries", {
        description: entry.description,
        projectId: entry.projectId || null,
        clientId: entry.projectId ? null : (entry.clientId || null),
        startTime: new Date(Math.min(...starts)).toISOString(),
        endTime: new Date(Math.max(...ends)).toISOString(),
        duration: totalDuration.toFixed(6),
        date: entry.date,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({
        title: "Time entry duplicated",
        description: "A copy was added to the same date.",
      });
    },
    onError: () => {
      toast({
        title: "Unable to duplicate entry",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const moveMobileEntry = async (entry: any, targetDate: Date) => {
    const sourceEntries: any[] = entry.sessionGroup?.length
      ? entry.sessionGroup
      : [entry];
    const date = format(targetDate, "yyyy-MM-dd");

    try {
      for (const item of sourceEntries) {
        const startTime = moveDatePreservingTime(new Date(item.startTime), targetDate);
        const endTime = item.endTime
          ? moveDatePreservingTime(new Date(item.endTime), targetDate)
          : null;
        await apiRequest("PUT", `/api/time-entries/${item.id}`, {
          date,
          startTime: startTime.toISOString(),
          endTime: endTime?.toISOString() || null,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      sourceEntries.forEach((item) => {
        window.dispatchEvent(new CustomEvent("timeEntryHighlight", {
          detail: { entryId: item.id },
        }));
      });
      toast({
        title: "Entry moved",
        description: `The entry is now on ${format(targetDate, "MMM d, yyyy")}.`,
      });
    } catch {
      toast({
        title: "Unable to move entry",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle play button click - use direct timer hook for synchronization
  const handlePlay = (description: string, projectId: number) => {
    // Find the project to get the client ID
    const project = projects.find(p => p.id === projectId);
    const clientId = project?.clientId;
    
    // First, populate the main tracker form with all the data
    setDescription(description);
    setSelectedProjectId(projectId);
    if (clientId) {
      setSelectedClientId(clientId);
    }
    
    // Then start the timer with the data for complete synchronization
    startTimerWithData(description, projectId);
    
    toast({
      title: "Timer started",
      description: `Started tracking: ${description}`,
    });
  };

  return (
    <>
      {/* Time View Toggle - Added more spacing from main tracker */}
      <div className="flex flex-col gap-4 mb-4 mt-8">
        {/* Large screens: All controls in one row */}
        <div className="hidden lg:flex items-center gap-2 lg:gap-4 flex-wrap">
          <div className="flex items-center flex-shrink-0">
            <label htmlFor="time-format" className="mr-2 text-sm font-medium text-gray-700 whitespace-nowrap">Format:</label>
            <div className="relative w-28 sm:w-32">
              <Select value={timeFormat} onValueChange={(val: "decimal" | "time") => setTimeFormat(val)}>
                <SelectTrigger id="time-format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="decimal">Decimal (1.5h)</SelectItem>
                  <SelectItem value="time">Time (1:30)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center flex-shrink-0">
            <label htmlFor="group-by" className="mr-2 text-sm font-medium text-gray-700 whitespace-nowrap">Group by:</label>
            <div className="relative w-28 sm:w-32">
              <Select value={groupBy} onValueChange={(val: "date" | "project" | "client") => setGroupBy(val)}>
                <SelectTrigger id="group-by">
                  <SelectValue placeholder="Select grouping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Date Range:</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm h-auto w-48 justify-start"
                >
                  <Calendar className="w-4 h-4" />
                  {startDate && endDate ? (
                    `${format(parseEntryDate(startDate), "MMM d")} - ${format(parseEntryDate(endDate), "MMM d, yyyy")}`
                  ) : startDate ? (
                    `${format(parseEntryDate(startDate), "MMM d, yyyy")} - Select end`
                  ) : (
                    "Select date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={undefined} // Don't use built-in selection
                  onSelect={(date) => {
                    if (!date) return;
                    
                    const clickedDate = format(date, "yyyy-MM-dd");
                    
                    if (dateSelectionState === "none") {
                      // First click - set start date
                      setStartDate(clickedDate);
                      setEndDate("");
                      setDateSelectionState("start");
                    } else if (dateSelectionState === "start") {
                      // Second click - set end date
                      if (clickedDate === startDate) {
                        // Clicking same date - reset
                        setStartDate("");
                        setEndDate("");
                        setDateSelectionState("none");
                      } else {
                        // Different date - set as end date (ensure proper order)
                        if (clickedDate < startDate) {
                          setStartDate(clickedDate);
                          setEndDate(startDate);
                        } else {
                          setEndDate(clickedDate);
                        }
                        setDateSelectionState("complete");
                      }
                    } else {
                      // Third click - reset and start new selection
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

        {/* Medium screens: Date moves to separate row */}
        <div className="hidden md:block lg:hidden">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center">
              <label htmlFor="time-format-md" className="mr-2 text-sm font-medium text-gray-700">Format:</label>
              <div className="relative inline-block w-32">
                <Select value={timeFormat} onValueChange={(val: "decimal" | "time") => setTimeFormat(val)}>
                  <SelectTrigger id="time-format-md">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="decimal">Decimal (1.5h)</SelectItem>
                    <SelectItem value="time">Time (1:30)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center">
              <label htmlFor="group-by-md" className="mr-2 text-sm font-medium text-gray-700">Group by:</label>
              <div className="relative inline-block w-32">
                <Select value={groupBy} onValueChange={(val: "date" | "project" | "client") => setGroupBy(val)}>
                  <SelectTrigger id="group-by-md">
                    <SelectValue placeholder="Select grouping" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Date Range:</label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-1 px-3 py-1.5 text-sm h-auto"
                  >
                    <Calendar className="w-4 h-4" />
                    {startDate ? format(parseEntryDate(startDate), "MMM d, yyyy") : "Start"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate ? parseEntryDate(startDate) : undefined}
                    onSelect={(date) => setStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-gray-500">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-1 px-3 py-1.5 text-sm h-auto"
                  >
                    <Calendar className="w-4 h-4" />
                    {endDate ? format(parseEntryDate(endDate), "MMM d, yyyy") : "End"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate ? parseEntryDate(endDate) : undefined}
                    onSelect={(date) => setEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Small screens: All controls stacked vertically */}
        <div className="md:hidden flex flex-col gap-3">
          <div className="flex items-center">
            <label htmlFor="time-format-mobile" className="mr-2 text-sm font-medium text-gray-700">Format:</label>
            <div className="relative inline-block w-32">
              <Select value={timeFormat} onValueChange={(val: "decimal" | "time") => setTimeFormat(val)}>
                <SelectTrigger id="time-format-mobile">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="decimal">Decimal (1.5h)</SelectItem>
                  <SelectItem value="time">Time (1:30)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center">
            <label htmlFor="group-by-mobile" className="mr-2 text-sm font-medium text-gray-700">Group by:</label>
            <div className="relative inline-block w-32">
              <Select value={groupBy} onValueChange={(val: "date" | "project" | "client") => setGroupBy(val)}>
                <SelectTrigger id="group-by-mobile">
                  <SelectValue placeholder="Select grouping" />
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
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-1 px-3 py-1.5 text-sm h-auto"
                  >
                    <Calendar className="w-4 h-4" />
                    {startDate ? format(parseEntryDate(startDate), "MMM d, yyyy") : "Start"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate ? parseEntryDate(startDate) : undefined}
                    onSelect={(date) => setStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-gray-500">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-1 px-3 py-1.5 text-sm h-auto"
                  >
                    <Calendar className="w-4 h-4" />
                    {endDate ? format(parseEntryDate(endDate), "MMM d, yyyy") : "End"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate ? parseEntryDate(endDate) : undefined}
                    onSelect={(date) => setEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>
      
      {/* Time Entries */}
      {isLoadingEntries ? (
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
                    const currency = defaultCurrency;
                    return dailyEarnings > 0 ? (
                      <div className="flex items-center gap-1">
                        <CurrencySelector
                          selectedCurrency={currency}
                          onCurrencyChange={handleCurrencyChange}
                          customCurrencies={customCurrencies}
                          manualRateCurrencyCodes={manualRateCurrencyCodes}
                          onSaveCustomCurrencies={handleSaveCustomCurrencies}
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
            
            {/* Enhanced Time Entry List - Clockify Style with Session Grouping */}
            <div className="hidden sm:block bg-white">
              {group.entries.map((entry) => (
                <EnhancedTimeEntry
                  key={`entry-${entry.id}`}
                  entry={entry}
                  sessionGroup={entry.sessionGroup}
                  clients={clients}
                  projects={projects}
                  timeFormat={timeFormat}
                  onDelete={(id) => setDeleteId(id)}
                  onPlay={handlePlay}
                  isNew={entryShouldHighlight(entry)}
                  isTracking={isTracking}
                  onStop={stopTimer}
                  allTimeEntries={enhancedEntries}
                />
              ))}
            </div>

            {/* Mobile Card View - only on very small screens */}
            <div className="sm:hidden space-y-3">
              {group.entries.map((entry) => {
                const formatDuration = (duration: string | number) => {
                  const numDuration = typeof duration === "string" ? parseFloat(duration) : duration;
                  if (timeFormat === "decimal") {
                    return `${numDuration.toFixed(2)}h`;
                  } else {
                    const totalSeconds = Math.max(0, Math.round(numDuration * 3600));
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = totalSeconds % 60;
                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                  }
                };

                return (
                  <div 
                    key={entry.id} 
                    className={`tickd-card-subtle tickd-spacing-md ${entryShouldHighlight(entry) ? 'animate-highlight' : ''}`}
                  >
                    {/* First line: Description and Time */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 mr-4">
                        <p className="font-medium text-gray-900 text-sm">{entry.description}</p>
                      </div>
                      <div className="font-mono font-semibold text-gray-900 text-sm">
                        {formatDuration(entry.duration || 0)}
                      </div>
                    </div>
                    
                    {/* Second line: Client, Project, and Actions */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium">{entry.client?.name || "—"}</span>
                        <span className="hidden sm:inline">•</span>
                        <span style={{ color: (entry.project as any)?.color || "#6B7280" }}>
                          {entry.project?.name || "—"}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        {handlePlay && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              if (isTracking) {
                                stopTimer();
                              } else if (entry.projectId) {
                                handlePlay(entry.description || "", entry.projectId);
                              }
                            }}
                            className={isTracking ? "text-red-600 hover:text-white hover:bg-red-600 h-8 w-8 p-0" : "text-green-600 hover:text-white hover:bg-green-600 h-8 w-8 p-0"}
                            title={isTracking ? "Stop timer" : "Continue tracking this task"}
                            aria-label={isTracking ? "Stop timer" : "Continue tracking this task"}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setMobileEdit({
                            entry,
                            description: entry.description || "",
                            clientId: String(entry.project?.clientId || entry.client?.id || ""),
                            projectId: String(entry.projectId || ""),
                            duration: timeFormat === "decimal"
                              ? Number(entry.exactDuration ?? entry.duration ?? 0).toFixed(2)
                              : formatTimeFromDecimal(Number(entry.exactDuration ?? entry.duration ?? 0)),
                          })}
                          className="text-primary hover:text-white hover:bg-primary h-8 w-8 p-0"
                          title="Edit time entry"
                          aria-label="Edit time entry"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => duplicateEntryMutation.mutate(entry)}
                          disabled={duplicateEntryMutation.isPending}
                          className="text-gray-500 hover:text-white hover:bg-gray-500 h-8 w-8 p-0"
                          title="Duplicate time entry"
                          aria-label="Duplicate time entry"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <TimeEntryNotes
                          timeEntryId={entry.id}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-white hover:bg-blue-600 h-8 w-8 p-0"
                              title="Add or view notes"
                              aria-label="Add or view notes"
                            >
                              <MessageSquare className="h-3 w-3" />
                            </Button>
                          }
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-500 hover:text-white hover:bg-gray-500 h-8 w-8 p-0"
                              title="Move entry to another date"
                              aria-label="Move entry to another date"
                            >
                              <Calendar className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <CalendarComponent
                              mode="single"
                              selected={parseEntryDate(entry.date)}
                              classNames={timeEntryCalendarClassNames}
                              onSelect={(date) => date && moveMobileEntry(entry, date)}
                              disabled={(date) => date > new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setDeleteId(entry.id)}
                          className="text-destructive hover:text-white hover:bg-destructive h-8 w-8 p-0"
                          title="Delete time entry"
                          aria-label="Delete time entry"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <Dialog open={mobileEdit !== null} onOpenChange={(open) => !open && setMobileEdit(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
          </DialogHeader>
          {mobileEdit && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="mobile-entry-description" className="text-sm font-medium">Description</label>
                <Input
                  id="mobile-entry-description"
                  value={mobileEdit.description}
                  onChange={(event) => setMobileEdit({ ...mobileEdit, description: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
                <Select
                  value={mobileEdit.clientId}
                  onValueChange={(clientId) => setMobileEdit({ ...mobileEdit, clientId, projectId: "" })}
                >
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Project</label>
                <Select
                  value={mobileEdit.projectId || "none"}
                  onValueChange={(projectId) => setMobileEdit({
                    ...mobileEdit,
                    projectId: projectId === "none" ? "" : projectId,
                  })}
                  disabled={!mobileEdit.clientId}
                >
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects
                      .filter((project) => project.clientId === Number(mobileEdit.clientId))
                      .map((project) => (
                        <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="mobile-entry-duration" className="text-sm font-medium">
                  Duration {timeFormat === "decimal" ? "(decimal hours)" : "(HH:MM:SS)"}
                </label>
                <Input
                  id="mobile-entry-duration"
                  inputMode={timeFormat === "decimal" ? "decimal" : "text"}
                  value={mobileEdit.duration}
                  onChange={(event) => setMobileEdit({ ...mobileEdit, duration: event.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setMobileEdit(null)}>Cancel</Button>
                <Button
                  onClick={() => mobileEntryMutation.mutate(mobileEdit)}
                  disabled={mobileEntryMutation.isPending || !mobileEdit.description.trim()}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected time entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Helper function to format decimal hours to HH:MM:SS
function formatTimeFromDecimal(decimalHours: number): string {
  const totalSeconds = Math.max(0, Math.round(decimalHours * 3600));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function parseDurationInput(value: string): number {
  const trimmed = value.trim();
  if (!trimmed.includes(":")) {
    return Number(trimmed);
  }

  const [hours = "0", minutes = "0", seconds = "0"] = trimmed.split(":");
  return Number(hours) + Number(minutes) / 60 + Number(seconds) / 3600;
}

function moveDatePreservingTime(value: Date, targetDate: Date): Date {
  const moved = new Date(targetDate);
  moved.setHours(value.getHours(), value.getMinutes(), value.getSeconds(), value.getMilliseconds());
  return moved;
}
