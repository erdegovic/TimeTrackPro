import { useState } from "react";
import { Edit, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface TimeEntryRowProps {
  entry: TimeEntry & { 
    client?: Client;
    project?: Project;
  };
  clients: Client[];
  projects: Project[];
  timeFormat: "decimal" | "time";
  onDelete: (id: number) => void;
  isNew?: boolean;
}

export default function TimeEntryRow({
  entry,
  clients,
  projects,
  timeFormat,
  onDelete,
  isNew = false
}: TimeEntryRowProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedEntry, setEditedEntry] = useState({ ...entry });
  const [editedClientId, setEditedClientId] = useState(entry.project?.clientId?.toString() || "");

  // Filtered projects for the selected client
  const clientProjects = editedClientId 
    ? projects.filter(project => project.clientId === Number(editedClientId))
    : [];

  const handleEdit = async () => {
    try {
      // First, validate the duration is a valid number
      const newDuration = parseFloat(editedEntry.duration || '0');
      if (isNaN(newDuration)) {
        throw new Error("Duration must be a valid number");
      }
      
      console.log("Updating time entry with new duration:", newDuration, "hours");
      
      // Calculate new end time based on the duration
      const startTime = new Date(entry.startTime);
      const durationMs = newDuration * 60 * 60 * 1000; // Convert hours to milliseconds
      const newEndTime = new Date(startTime.getTime() + durationMs);
      console.log("New end time calculated:", newEndTime.toISOString());
      
      // Store duration as decimal string with 2 decimal places
      const formattedDuration = newDuration.toFixed(2);
      console.log("Formatted duration:", formattedDuration);
      
      try {
        // Send the update request with only the duration and description to prevent conflicts
        await apiRequest("PUT", `/api/time-entries/${entry.id}`, {
          duration: formattedDuration,
          description: editedEntry.description || entry.description
        });
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
        
        setIsEditing(false);
        toast({
          title: "Time entry updated",
          description: `Duration updated to ${formattedDuration} hours.`,
        });
      } catch (updateError) {
        console.error("Update request failed:", updateError);
        // Try a simpler update with just the duration if the first attempt fails
        await apiRequest("PUT", `/api/time-entries/${entry.id}`, {
          duration: formattedDuration
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
        setIsEditing(false);
        toast({
          title: "Time entry updated",
          description: `Duration updated to ${formattedDuration} hours.`,
        });
      }
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

  // Format duration with precise time conversion - using the start and end times directly
  const formatDuration = (duration: string | number) => {
    // If we have start and end times in the entry, calculate the exact duration from those
    if (entry.startTime && entry.endTime) {
      const startTime = new Date(entry.startTime);
      const endTime = new Date(entry.endTime);
      const diffMs = endTime.getTime() - startTime.getTime();
      
      if (timeFormat === "decimal") {
        // Convert to hours with 2 decimal places
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
    
    // Fallback to using the duration field if no start/end times
    let durationNum = 0;
    if (typeof duration === "string") {
      durationNum = parseFloat(duration) || 0;
    } else if (typeof duration === "number") {
      durationNum = duration;
    }
    
    if (timeFormat === "decimal") {
      return `${durationNum.toFixed(2)}h`;
    } else {
      // Convert hours to HH:MM:SS
      const hours = Math.floor(durationNum);
      const minutes = Math.floor((durationNum - hours) * 60);
      const seconds = Math.round(((durationNum - hours) * 60 - minutes) * 60);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  };

  // Add CSS class for new entries with animation
  const newEntryClass = isNew 
    ? "bg-green-100 transition-colors duration-3000 animate-highlight" 
    : "";

  return (
    <>
      <tr className={newEntryClass}>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.description}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.client?.name || "—"}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.project?.name || "—"}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">
          {formatDuration(entry.duration || 0)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-2">
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="text-primary hover:text-primary/80">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDuplicate} className="text-gray-500 hover:text-gray-700">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(entry.id)} className="text-destructive hover:text-destructive/80">
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
                  setEditedEntry({ ...editedEntry, projectId: 0 }); // Reset project when client changes
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
              <label className="text-sm font-medium text-gray-700">Project</label>
              <Select 
                value={editedEntry.projectId.toString()} 
                onValueChange={(val) => setEditedEntry({ ...editedEntry, projectId: Number(val) })}
                disabled={!editedClientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
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
              <div className="flex items-center gap-2">
                {timeFormat === "decimal" ? (
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
                ) : (
                  // Time format (HH:MM:SS)
                  <Input
                    type="text"
                    value={formatDuration(editedEntry.duration || "0")}
                    onChange={(e) => {
                      const timeValue = e.target.value;
                      // Allow time format input (HH:MM:SS or HH:MM)
                      if (/^(\d{1,2}):(\d{1,2})(:(\d{1,2}))?$/.test(timeValue) || timeValue === "") {
                        // Parse time to decimal hours
                        const parts = timeValue.split(":");
                        const hours = parseInt(parts[0]) || 0;
                        const minutes = parts.length > 1 ? (parseInt(parts[1]) || 0) / 60 : 0;
                        const seconds = parts.length > 2 ? (parseInt(parts[2]) || 0) / 3600 : 0;
                        const decimalHours = (hours + minutes + seconds).toFixed(2);
                        
                        console.log("Setting new duration from time:", timeValue, "to decimal:", decimalHours);
                        setEditedEntry({ ...editedEntry, duration: decimalHours });
                      }
                    }}
                    className="font-mono"
                    placeholder="00:00:00"
                  />
                )}
                <span className="text-xs text-gray-500">
                  {timeFormat === "decimal" ? "hours" : "HH:MM:SS"}
                </span>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={!editedEntry.description || !editedEntry.projectId}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
