import { useState, useEffect, useMemo, useRef } from "react";
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
import { useCreativitySidebar } from "@/components/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Edit, Copy, Trash2, Play, Calendar } from "lucide-react";
import { TimeEntry, Client, Project } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { useToast } from "@/hooks/use-toast";
import { CurrencySelector } from "@/components/ui/CurrencySelector";
import TimeEntryRow from "./TimeEntry";
import EnhancedTimeEntry from "./EnhancedTimeEntry";

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
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [newEntryIds, setNewEntryIds] = useState<number[]>([]);
  
  // Refs for date inputs
  const startDateRefDesktop = useRef<HTMLInputElement>(null);
  const endDateRefDesktop = useRef<HTMLInputElement>(null);
  const startDateRefMedium = useRef<HTMLInputElement>(null);
  const endDateRefMedium = useRef<HTMLInputElement>(null);
  const startDateRefMobile = useRef<HTMLInputElement>(null);
  const endDateRefMobile = useRef<HTMLInputElement>(null);

  // Fetch time entries
  const { data: timeEntries = [], isLoading: isLoadingEntries, refetch: refetchTimeEntries } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries"],
    staleTime: 0, // Always fetch fresh data
    cacheTime: 0   // Don't cache results
  });

  // Fetch settings for currency information
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

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

  const handleCurrencyChange = (newCurrency: string) => {
    updateCurrencyMutation.mutate(newCurrency);
  };

  // Debug logging to track the issue
  console.log(`[TimeEntryList] Received ${timeEntries.length} time entries from API`);
  if (timeEntries.length < 10) {
    console.log(`[TimeEntryList] Full API response:`, timeEntries);
  }

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
      
      // Log the entry details for debugging
      console.log(`Entry ${entry.id}: using stored duration ${duration} hours`);
      
      return { 
        ...entry, 
        project, 
        client, 
        // Store the duration in a consistent field
        exactDuration: duration 
      };
    });
  }, [timeEntries, projects, clients, isDataLoading, startDate, endDate]);

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
        groupKey = entry.projectId.toString();
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

  // Currency conversion rates (simplified for demo - in production, use a real API)
  const exchangeRates: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.35,
    AUD: 1.52,
    JPY: 150,
    CHF: 0.91,
    CNY: 7.2
  };

  // Function to convert currency
  const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency) return amount;
    
    // Convert to USD first, then to target currency
    const usdAmount = amount / (exchangeRates[fromCurrency] || 1);
    return usdAmount * (exchangeRates[toCurrency] || 1);
  };

  // Function to calculate daily earnings with proper currency conversion
  const calculateDailyEarnings = (entries: any[]) => {
    const defaultCurrency = (settings as any)?.defaultCurrency || "USD";
    
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
      const convertedEarnings = convertCurrency(projectEarnings, projectCurrency, defaultCurrency);
      
      console.log(`[Currency Debug] Entry ${entry.id}: ${duration}h × ${hourlyRate} ${projectCurrency} = ${projectEarnings} ${projectCurrency} → ${convertedEarnings} ${defaultCurrency}`);
      
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

  // Debug logging to track the grouping issue
  console.log(`[TimeEntryList] Grouped entries:`, Object.keys(groupedEntries));
  console.log(`[TimeEntryList] Total groups: ${sortedGroups.length}`);
  sortedGroups.forEach(([key, group]) => {
    console.log(`[TimeEntryList] Group "${key}": ${group.entries.length} entries`);
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
        <div className={`hidden ${creativitySidebarCollapsed ? 'lg:flex' : 'xl:flex'} items-center gap-4`}>
          <div className="flex items-center">
            <label htmlFor="time-format" className="mr-2 text-sm font-medium text-gray-700">Format:</label>
            <div className="relative inline-block w-32">
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
          
          <div className="flex items-center">
            <label htmlFor="group-by" className="mr-2 text-sm font-medium text-gray-700">Group by:</label>
            <div className="relative inline-block w-32">
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
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Date Range:</label>
            <div className="relative">
              <input
                ref={startDateRefDesktop}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              />
              <div className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 pointer-events-none">
                <Calendar className="w-4 h-4" />
                {startDate ? new Date(startDate).toLocaleDateString() : "Start"}
              </div>
            </div>
            <span className="text-gray-500">to</span>
            <div className="relative">
              <input
                ref={endDateRefDesktop}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              />
              <div className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 pointer-events-none">
                <Calendar className="w-4 h-4" />
                {endDate ? new Date(endDate).toLocaleDateString() : "End"}
              </div>
            </div>
          </div>
        </div>

        {/* Medium screens: Date moves to separate row */}
        <div className={`${creativitySidebarCollapsed ? 'hidden md:block lg:hidden' : 'hidden lg:block xl:hidden'}`}>
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
              <div className="relative">
                <input
                  ref={startDateRefMedium}
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
                <div className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 pointer-events-none">
                  <Calendar className="w-4 h-4" />
                  {startDate ? new Date(startDate).toLocaleDateString() : "Start"}
                </div>
              </div>
              <span className="text-gray-500">to</span>
              <div className="relative">
                <input
                  ref={endDateRefMedium}
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
                <div className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 pointer-events-none">
                  <Calendar className="w-4 h-4" />
                  {endDate ? new Date(endDate).toLocaleDateString() : "End"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Small screens: All controls stacked vertically */}
        <div className={`${creativitySidebarCollapsed ? 'md:hidden' : 'lg:hidden'} flex flex-col gap-3`}>
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
              <div className="relative">
                <input
                  ref={startDateRefMobile}
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
                <div className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 pointer-events-none">
                  <Calendar className="w-4 h-4" />
                  {startDate ? new Date(startDate).toLocaleDateString() : "Start"}
                </div>
              </div>
              <span className="text-gray-500">to</span>
              <div className="relative">
                <input
                  ref={endDateRefMobile}
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
                <div className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 pointer-events-none">
                  <Calendar className="w-4 h-4" />
                  {endDate ? new Date(endDate).toLocaleDateString() : "End"}
                </div>
              </div>
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
            
            {/* Enhanced Time Entry List - Clockify Style with Session Grouping */}
            <div className="bg-white">
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
                  isNew={newEntryIds.includes(entry.id)}
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
                    const hours = Math.floor(numDuration);
                    const minutes = Math.floor((numDuration - hours) * 60);
                    const seconds = Math.round(((numDuration - hours) * 60 - minutes) * 60);
                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                  }
                };

                return (
                  <div 
                    key={entry.id} 
                    className={`tickd-card-subtle tickd-spacing-md ${newEntryIds.includes(entry.id) ? 'animate-highlight' : ''}`}
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
                              } else {
                                handlePlay(entry.description || "", entry.projectId);
                              }
                            }}
                            className={isTracking ? "text-red-600 hover:text-white hover:bg-red-600 h-8 w-8 p-0" : "text-green-600 hover:text-white hover:bg-green-600 h-8 w-8 p-0"}
                            title={isTracking ? "Stop timer" : "Continue tracking this task"}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            // Trigger edit via the TimeEntryRow component
                            const editEvent = new CustomEvent('editEntry', { detail: { entryId: entry.id } });
                            window.dispatchEvent(editEvent);
                          }}
                          className="text-primary hover:text-white hover:bg-primary h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            // Trigger duplicate via the TimeEntryRow component
                            const duplicateEvent = new CustomEvent('duplicateEntry', { detail: { entryId: entry.id } });
                            window.dispatchEvent(duplicateEvent);
                          }}
                          className="text-gray-500 hover:text-white hover:bg-gray-500 h-8 w-8 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setDeleteId(entry.id)}
                          className="text-destructive hover:text-white hover:bg-destructive h-8 w-8 p-0"
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
  const hours = Math.floor(decimalHours);
  const minutes = Math.floor((decimalHours - hours) * 60);
  const seconds = Math.round(((decimalHours - hours) * 60 - minutes) * 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
