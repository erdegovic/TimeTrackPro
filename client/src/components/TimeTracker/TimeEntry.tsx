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
}

export default function TimeEntryRow({
  entry,
  clients,
  projects,
  timeFormat,
  onDelete,
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
      await apiRequest("PUT", `/api/time-entries/${entry.id}`, {
        description: editedEntry.description,
        projectId: editedEntry.projectId,
        // Other fields that might have changed
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      
      setIsEditing(false);
      toast({
        title: "Time entry updated",
        description: "Your time entry has been updated successfully.",
      });
    } catch (error) {
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

  const formatDuration = (duration: string | number) => {
    let durationNum = 0;
    
    // Ensure we have a valid number to work with
    if (typeof duration === "string") {
      // Try to parse the string as a float
      durationNum = parseFloat(duration) || 0;
    } else if (typeof duration === "number") {
      durationNum = duration;
    }
    
    // Add proper formatting based on the format option
    if (timeFormat === "decimal") {
      // Show as decimal hours with 2 decimal places
      return `${durationNum.toFixed(2)}h`;
    } else {
      // Convert decimal hours to HH:MM:SS format
      const hours = Math.floor(durationNum);
      const minutes = Math.floor((durationNum - hours) * 60);
      const seconds = Math.round(((durationNum - hours) * 60 - minutes) * 60);
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  };

  return (
    <>
      <tr>
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
              <Input
                value={formatDuration(editedEntry.duration || 0)}
                onChange={(e) => {
                  // Handle both decimal and HH:MM:SS format based on timeFormat
                  let newDuration;
                  if (timeFormat === "decimal") {
                    newDuration = parseFloat(e.target.value) || 0;
                  } else {
                    // Parse HH:MM:SS to decimal hours
                    const parts = e.target.value.split(":");
                    const hours = parseInt(parts[0]) || 0;
                    const minutes = parts.length > 1 ? (parseInt(parts[1]) || 0) / 60 : 0;
                    const seconds = parts.length > 2 ? (parseInt(parts[2]) || 0) / 3600 : 0;
                    newDuration = hours + minutes + seconds;
                  }
                  // Store duration as a string to preserve decimal precision
                  setEditedEntry({ ...editedEntry, duration: newDuration.toString() });
                }}
                className="font-mono"
              />
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
