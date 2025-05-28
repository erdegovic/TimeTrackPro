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
import { useCreativitySidebar } from "@/components/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Edit, Copy, Trash2, Play } from "lucide-react";
import { TimeEntry, Client, Project } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { useToast } from "@/hooks/use-toast";
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
  const [filterDate, setFilterDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [newEntryIds, setNewEntryIds] = useState<number[]>([]);

  // Fetch time entries
  const { data: timeEntries = [], isLoading: isLoadingEntries } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries"]
  });
  
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
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Group entries by description, project, and date for session grouping
  const groupedSessions = useMemo(() => {
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

  // Enhanced time entries with client and project data and ALWAYS use the 
  // stored duration value to ensure edited values are used
  const enhancedEntries = timeEntries.map(entry => {
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
          duration: entry.exactDuration || Number(entry.duration || 0)
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
      acc[groupKey].totalHours += entry.exactDuration || Number(entry.duration || 0);
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
          
          <div className="flex items-center">
            <label htmlFor="filter-date" className="mr-2 text-sm font-medium text-gray-700">Date:</label>
            <Input
              type="date"
              id="filter-date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-40"
            />
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
          
          <div className="flex items-center">
            <label htmlFor="filter-date-md" className="mr-2 text-sm font-medium text-gray-700">Date:</label>
            <Input
              type="date"
              id="filter-date-md"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-40"
            />
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
          
          <div className="flex items-center">
            <label htmlFor="filter-date-mobile" className="mr-2 text-sm font-medium text-gray-700">Date:</label>
            <Input
              type="date"
              id="filter-date-mobile"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-40"
            />
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
                <span className="text-sm font-medium text-gray-500">
                  Total: {timeFormat === "decimal" ? group.totalHours.toFixed(1) + "h" : formatTimeFromDecimal(group.totalHours)}
                </span>
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
