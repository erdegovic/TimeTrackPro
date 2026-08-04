import { useState, useEffect } from "react";
import { Edit, Copy, Trash2, Play, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeEntryNotes } from "./TimeEntryNotes";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TimeEntry, Client, Project } from "@shared/schema";
import { formatDecimalToTime, parseTimeToDecimal, formatDurationDisplay } from "./TimeEntryFormats";

interface TimeEntryRowProps {
  entry: TimeEntry & { 
    client?: Client;
    project?: Project;
  };
  clients: Client[];
  projects: Project[];
  timeFormat: "decimal" | "time";
  onDelete: (id: number) => void;
  onPlay?: (description: string, projectId: number) => void;
  isNew?: boolean;
}

export default function TimeEntryRow({
  entry,
  clients,
  projects,
  timeFormat,
  onDelete,
  onPlay,
  isNew = false
}: TimeEntryRowProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedEntry, setEditedEntry] = useState({ ...entry });
  const [editedClientId, setEditedClientId] = useState(
    entry.project?.clientId?.toString() || 
    entry.clientId?.toString() || 
    ""
  );
  const [timeInputValue, setTimeInputValue] = useState("");
  
  // Set initial values when dialog opens
  useEffect(() => {
    if (isEditing) {
      // Reset edited entry to current entry values
      setEditedEntry({ ...entry });
      
      // Set client ID from project or direct client assignment
      const clientId = entry.project?.clientId?.toString() || 
                      entry.clientId?.toString() || 
                      "";
      setEditedClientId(clientId);
      
      // Set time input value for time format
      if (timeFormat === "time") {
        setTimeInputValue(formatDecimalToTime(editedEntry.duration || "0"));
      }
    }
  }, [isEditing, entry, timeFormat]);

  // Filtered projects for the selected client
  const clientProjects = editedClientId 
    ? projects.filter(project => project.clientId === Number(editedClientId))
    : [];

  const handleEdit = async () => {
    try {
      // Get the duration directly from our edited entry state which holds the correct decimal value
      let newDuration = parseFloat(editedEntry.duration || "0");
      
      // Final safety check
      if (isNaN(newDuration)) {
        throw new Error("Duration must be a valid number");
      }
      
      console.log("Updating time entry with new duration:", newDuration, "hours");
      
      // Get the project to calculate hourly rate (if project is selected)
      const project = editedEntry.projectId ? projects.find(p => p.id === editedEntry.projectId) : null;
      
      // Get the client (either from selected project or directly selected client)
      const client = project ? 
        clients.find(c => c.id === project.clientId) :
        clients.find(c => c.id === Number(editedClientId));
      
      // Calculate hourly rate and amount
      const hourlyRate = project?.hourlyRate || "0";
      const amount = (parseFloat(hourlyRate) * newDuration).toFixed(2);
      
      console.log(`Calculated amount: ${amount} from hourly rate ${hourlyRate} and duration ${newDuration}`);
      
      // Store duration as decimal string with 2 decimal places to ensure consistency
      const formattedDuration = newDuration.toFixed(2);
      
      // Build a complete update object with all necessary fields
      const updateData = {
        duration: formattedDuration,
        description: editedEntry.description || entry.description,
        projectId: editedEntry.projectId || null,
        clientId: editedEntry.projectId ? null : Number(editedClientId) || null,
        hourlyRate: hourlyRate,
        amount: amount
      };
      
      // Create a local optimistically updated entry for immediate UI update
      // This avoids the need for a page refresh
      const optimisticEntry = {
        ...entry,
        ...updateData,
        // Make sure we include any fields needed for display
        project: project || null,
        client: client || entry.client
      };
      
      // Close dialog immediately for better UX
      setIsEditing(false);
      
      console.log("Sending update with data:", updateData);
      
      // Update the UI optimistically with our edited entry
      const prevEntries = queryClient.getQueryData(["/api/time-entries"]) || [];
      
      // Update cache optimistically
      queryClient.setQueryData(["/api/time-entries"], (oldData: any) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map((item: any) => 
          item.id === entry.id ? optimisticEntry : item
        );
      });
      
      // Send the update request
      const response = await fetch(`/api/time-entries/${entry.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        // If the server request failed, revert to previous data
        queryClient.setQueryData(["/api/time-entries"], prevEntries);
        throw new Error(`Server returned ${response.status}`);
      }
      
      const updatedEntry = await response.json();
      console.log('TimeEntry updated successfully:', updatedEntry);
      
      // Invalidate queries to ensure data stays fresh, but don't clear the entire cache
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      
      // Let the user know it worked
      toast({
        title: "Time entry updated",
        description: `Duration updated to ${formattedDuration} hours.`,
      });
    } catch (error) {
      console.error("Failed to update time entry:", error);
      toast({
        title: "Error",
        description: "Failed to update time entry. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDuplicate = async () => {
    try {
      // Create a new entry with the same data but new ID
      const { id, ...entryWithoutId } = entry;
      
      await apiRequest("POST", "/api/time-entries", entryWithoutId);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      
      toast({
        title: "Time entry duplicated",
        description: "Your time entry has been duplicated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to duplicate time entry. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Format duration for display in the table - PRIORITIZE stored duration value
  const formatDuration = (duration: string | number) => {
    // First, always use the stored duration value if it exists
    // This ensures edited duration values are displayed correctly
    let durationNum = 0;
    
    try {
      // Process the duration value from the database
      if (typeof duration === "string") {
        durationNum = parseFloat(duration) || 0;
      } else if (typeof duration === "number") {
        durationNum = duration;
      }
      
      // Format the duration based on the selected time format
      return timeFormat === "decimal" 
        ? `${durationNum.toFixed(2)}h` 
        : formatDecimalToTime(durationNum.toString());
        
    } catch (e) {
      console.error("Error formatting duration:", e, duration);
      
      // If we had an error parsing the duration, fall back to calculating from timestamps
      // This should only happen if the duration field is somehow corrupted
      if (entry.startTime && entry.endTime) {
        const startTime = new Date(entry.startTime);
        const endTime = new Date(entry.endTime);
        const diffMs = endTime.getTime() - startTime.getTime();
        
        if (timeFormat === "decimal") {
          const diffHours = diffMs / (1000 * 60 * 60);
          return `${diffHours.toFixed(2)}h`;
        } else {
          // Get total seconds
          const totalSeconds = Math.floor(diffMs / 1000);
          
          // Calculate hours, minutes, seconds
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          
          // Format with leading zeros
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
      }
      
      // Last resort default
      return timeFormat === "decimal" ? "0.00h" : "00:00:00";
    }
  };

  // Add CSS class for new entries with animation
  const newEntryClass = isNew 
    ? "bg-green-100 transition-colors duration-3000 animate-highlight" 
    : "";

  return (
    <>
      <tr className={newEntryClass}>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <span 
            className="cursor-pointer hover:text-blue-600 hover:underline transition-colors"
            onClick={() => setIsEditing(true)}
            title="Click to edit description"
          >
            {entry.description}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <span 
            className="cursor-pointer hover:text-blue-600 hover:underline transition-colors"
            onClick={() => setIsEditing(true)}
            title="Click to edit client"
          >
            {entry.client?.name || "—"}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <span 
            style={{ color: entry.project?.color || "#000000" }}
            className="cursor-pointer hover:opacity-75 hover:underline transition-all"
            onClick={() => setIsEditing(true)}
            title="Click to edit project"
          >
            {entry.project?.name || (entry.client?.name ? `${entry.client.name} (no project)` : "—")}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">
          {formatDuration(entry.duration || 0)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-2">
          {onPlay && entry.projectId && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onPlay(entry.description || "", entry.projectId!)}
              className="text-green-600 hover:text-white hover:bg-green-600"
              title="Continue tracking this task"
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
          <TimeEntryNotes 
            timeEntryId={entry.id}
            trigger={
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-blue-600 hover:text-white hover:bg-blue-600"
                title="Add or view notes"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            }
          />
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="text-primary hover:text-white hover:bg-primary">
            <Edit className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" onClick={() => onDelete(entry.id)} className="text-destructive hover:text-white hover:bg-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </td>
      </tr>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Input
                value={editedEntry.description}
                onChange={(e) => setEditedEntry({ ...editedEntry, description: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Client</label>
              <Select 
                value={editedClientId} 
                onValueChange={(val) => {
                  setEditedClientId(val);
                  setEditedEntry({ ...editedEntry, projectId: null }); // Reset project when client changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Project (optional)</label>
              <Select 
                value={editedEntry.projectId?.toString() || ""} 
                onValueChange={(val) => setEditedEntry({ ...editedEntry, projectId: val ? Number(val) : null })}
                disabled={!editedClientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No project</SelectItem>
                  {clientProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Duration</label>
              {timeFormat === "decimal" ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={editedEntry.duration || "0.00"}
                    onChange={(e) => {
                      // Allow only numeric input with decimal point
                      const value = e.target.value;
                      if (/^(\d*\.?\d*)$/.test(value) || value === "") {
                        console.log("Setting new duration:", value);
                        setEditedEntry({ ...editedEntry, duration: value });
                      }
                    }}
                    className="font-mono"
                    placeholder="0.00"
                  />
                  <span className="text-xs text-gray-500">hours</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="text" 
                    value={timeInputValue}
                    onChange={(e) => {
                      // Allow direct editing of the time string without any auto-formatting or calculations
                      // Just take the value exactly as typed
                      const value = e.target.value;
                      if (/^[0-9:]*$/.test(value)) {
                        setTimeInputValue(value);
                      }
                    }}
                    onBlur={(e) => {
                      // Only when the field loses focus, parse the time and update the duration
                      try {
                        const value = e.target.value;
                        console.log("Processing time input on blur:", value);
                        
                        // If it's a simple number, treat as minutes
                        if (/^\d+$/.test(value)) {
                          const minutes = parseInt(value, 10) || 0;
                          const decimalHours = minutes / 60;
                          setEditedEntry({
                            ...editedEntry,
                            duration: decimalHours.toString()
                          });
                          
                          // Update the display to show the formatted time
                          setTimeInputValue(formatDecimalToTime(decimalHours));
                        }
                        // If it looks like a time string with colons
                        else if (value.includes(':')) {
                          // Split the time into parts
                          const parts = value.split(':');
                          // Ensure we have at least HH:MM format
                          if (parts.length >= 2) {
                            const hours = parseInt(parts[0], 10) || 0;
                            const minutes = parseInt(parts[1], 10) || 0;
                            const seconds = parts.length > 2 ? (parseInt(parts[2], 10) || 0) : 0;
                            
                            // Calculate the decimal value
                            const decimalValue = hours + (minutes / 60) + (seconds / 3600);
                            console.log(`Parsed time ${value} to ${decimalValue} hours`);
                            
                            // Update the duration in the entry
                            setEditedEntry({
                              ...editedEntry,
                              duration: decimalValue.toString()
                            });
                            
                            // Format the time properly for display
                            const formattedTime = 
                              `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                            setTimeInputValue(formattedTime);
                          }
                        }
                      } catch (e) {
                        console.error("Error processing time input:", e);
                      }
                    }}
                    className="font-mono"
                    placeholder="HH:MM:SS"
                  />
                  <span className="text-xs text-gray-500">HH:MM:SS</span>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={!editedEntry.description || (!editedEntry.projectId && !editedClientId)}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
