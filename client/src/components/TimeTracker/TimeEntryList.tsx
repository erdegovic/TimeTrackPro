import { useState } from "react";
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
import { TimeEntry, Client, Project } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TimeEntryRow from "./TimeEntry";

export default function TimeEntryList() {
  const { toast } = useToast();
  const [timeFormat, setTimeFormat] = useState<"decimal" | "time">("time");
  const [groupBy, setGroupBy] = useState<"date" | "project" | "client">("date");
  const [filterDate, setFilterDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Fetch time entries
  const { data: timeEntries = [], isLoading: isLoadingEntries } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries"],
  });

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Enhanced time entries with client and project data
  const enhancedEntries = timeEntries.map(entry => {
    const project = projects.find(p => p.id === entry.projectId);
    const client = project ? clients.find(c => c.id === project.clientId) : undefined;
    return { ...entry, project, client };
  });

  // Group entries by date, project, or client
  const groupedEntries = enhancedEntries.reduce((acc, entry) => {
    let groupKey = "";
    let groupLabel = "";
    
    if (groupBy === "date") {
      groupKey = entry.date;
      
      // Format date for display
      const entryDate = new Date(entry.date);
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
    acc[groupKey].totalHours += Number(entry.duration || 0);
    
    return acc;
  }, {} as Record<string, { label: string; entries: typeof enhancedEntries; totalHours: number }>);

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

  return (
    <>
      {/* Time View Toggle */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
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
          
          <div className="hidden md:flex items-center">
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
        </div>
        
        <div className="flex items-center space-x-2">
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-40"
          />
        </div>
      </div>
      
      {/* Time Entries */}
      {isLoadingEntries ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : sortedGroups.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-gray-500">No time entries found. Start tracking your time!</p>
        </div>
      ) : (
        sortedGroups.map(([groupKey, group]) => (
          <div key={groupKey} className="bg-white shadow rounded-lg mb-6">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">{group.label}</h2>
                <span className="text-sm font-medium text-gray-500">
                  Total: {timeFormat === "decimal" ? group.totalHours.toFixed(1) + "h" : formatTimeFromDecimal(group.totalHours)}
                </span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 table-striped">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {group.entries.map((entry) => (
                    <TimeEntryRow
                      key={entry.id}
                      entry={entry}
                      clients={clients}
                      projects={projects}
                      timeFormat={timeFormat}
                      onDelete={(id) => setDeleteId(id)}
                    />
                  ))}
                </tbody>
              </table>
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
