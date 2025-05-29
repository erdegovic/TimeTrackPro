import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Copy, Trash2, Play, Square, ChevronDown, ChevronRight } from "lucide-react";
import { TimeEntry, Client, Project } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatTimeFromDecimal } from "@/lib/utils/timeUtils";

interface AnimatedTimeEntryProps {
  entry: TimeEntry & { 
    client?: Client;
    project?: Project;
  };
  sessionGroup?: Array<TimeEntry & { client?: Client; project?: Project; }>;
  clients: Client[];
  projects: Project[];
  timeFormat: "decimal" | "time";
  onDelete: (id: number) => void;
  onPlay?: (description: string, projectId: number) => void;
  isNew?: boolean;
  isTracking?: boolean;
  onStop?: () => void;
  allTimeEntries: Array<TimeEntry & { client?: Client; project?: Project; }>;
}

export default function AnimatedTimeEntry({
  entry,
  sessionGroup,
  clients,
  projects,
  timeFormat,
  onDelete,
  onPlay,
  isNew = false,
  isTracking = false,
  onStop,
  allTimeEntries
}: AnimatedTimeEntryProps) {
  const { toast } = useToast();
  const [isEditingEntry, setIsEditingEntry] = useState(false);
  const [editDescription, setEditDescription] = useState(entry.description || "");
  const [editProjectId, setEditProjectId] = useState(entry.projectId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Simple animation function
  const playMergeAnimation = async (currentId: number, targetId: number) => {
    const currentEl = document.querySelector(`[data-entry-id="${currentId}"]`) as HTMLElement;
    const targetEl = document.querySelector(`[data-entry-id="${targetId}"]`) as HTMLElement;
    
    if (!currentEl || !targetEl) return;
    
    setIsAnimating(true);
    
    // Flash blue
    [currentEl, targetEl].forEach(el => {
      el.style.backgroundColor = '#dbeafe';
      el.style.transition = 'background-color 0.3s';
    });
    
    // Slide animation
    const currentRect = currentEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const deltaY = targetRect.top - currentRect.top;
    
    currentEl.style.transform = `translateY(${deltaY}px)`;
    currentEl.style.transition = 'all 0.6s ease-out';
    currentEl.style.opacity = '0.7';
    
    setTimeout(() => {
      // Reset styles
      [currentEl, targetEl].forEach(el => {
        el.style.backgroundColor = '';
        el.style.transform = '';
        el.style.opacity = '';
        el.style.transition = '';
      });
      setIsAnimating(false);
    }, 600);
  };

  // Update mutation with animation
  const updateMutation = useMutation({
    mutationFn: async (updateData: any) => {
      // Check for merge target before update
      const targetEntry = allTimeEntries.find(e => 
        e.id !== entry.id &&
        e.date === entry.date &&
        e.description === updateData.description &&
        e.projectId === updateData.projectId
      );
      
      if (targetEntry) {
        console.log('Merge detected, playing animation...');
        await playMergeAnimation(entry.id, targetEntry.id);
      }
      
      return apiRequest("PUT", `/api/time-entries/${entry.id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      setIsEditingEntry(false);
      toast({
        title: "Entry updated",
        description: "Time entry has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update entry. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    updateMutation.mutate({
      description: editDescription.trim(),
      projectId: editProjectId
    });
  };

  // Group entries by session (same description, project, consecutive times)
  const groupedEntry = sessionGroup ? {
    description: entry.description,
    project: entry.project,
    client: entry.client,
    totalDuration: sessionGroup.reduce((sum, block) => sum + parseFloat(block.duration || "0"), 0),
    blocks: sessionGroup.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    startTime: sessionGroup[0]?.startTime,
    endTime: sessionGroup[sessionGroup.length - 1]?.endTime
  } : {
    description: entry.description,
    project: entry.project,
    client: entry.client,
    totalDuration: parseFloat(entry.duration || "0"),
    blocks: [entry],
    startTime: entry.startTime,
    endTime: entry.endTime
  };

  if (!groupedEntry) return null;

  const isGrouped = groupedEntry.blocks.length > 1;
  const canEditDirectly = !isGrouped;

  return (
    <div 
      data-entry-id={entry.id}
      className={`border-b border-gray-200 transition-all duration-500 ${isNew ? 'bg-green-50' : ''} ${isAnimating ? 'bg-blue-100' : ''}`}
    >
      {/* Main entry row */}
      <div className={`flex items-center px-6 py-4 hover:bg-gray-50 transition-colors`}>
        {/* Expand/collapse button for grouped entries */}
        <div className="w-8 flex justify-center">
          {isGrouped ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0 h-6 w-6"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            groupedEntry.blocks.length > 1 ? (
              <div className="text-sm text-gray-400 font-medium">
                {groupedEntry.blocks.length}
              </div>
            ) : null
          )}
        </div>

        {/* Description */}
        <div className="flex-1 min-w-0 px-4">
          {isEditingEntry && canEditDirectly ? (
            <Input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full"
              autoFocus
            />
          ) : (
            <div className="text-sm text-gray-900 truncate">
              {groupedEntry.description || "No description"}
            </div>
          )}
        </div>

        {/* Client */}
        <div className="w-32 px-2 text-sm text-gray-500 truncate">
          {groupedEntry.client?.name || "—"}
        </div>

        {/* Project */}
        <div className="w-32 px-2">
          {isEditingEntry && canEditDirectly ? (
            <Select value={editProjectId?.toString()} onValueChange={(val) => setEditProjectId(parseInt(val))}>
              <SelectTrigger className="w-full h-8">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    <span style={{ color: project.color }}>{project.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm truncate">
              <span style={{ color: groupedEntry.project?.color || "#000000" }}>
                {groupedEntry.project?.name || "—"}
              </span>
            </div>
          )}
        </div>

        {/* Time Range */}
        <div className="w-32 px-2 text-sm text-gray-500 font-mono">
          {groupedEntry.startTime && groupedEntry.endTime ? (
            `${format(new Date(groupedEntry.startTime), 'HH:mm')} - ${format(new Date(groupedEntry.endTime), 'HH:mm')}`
          ) : (
            "—"
          )}
        </div>

        {/* Duration */}
        <div className="w-24 px-2 text-sm font-mono font-medium text-gray-900">
          {timeFormat === "decimal" 
            ? `${groupedEntry.totalDuration.toFixed(2)}h` 
            : formatTimeFromDecimal(groupedEntry.totalDuration)
          }
        </div>

        {/* Actions */}
        <div className="w-32 flex items-center justify-end space-x-1">
          {isEditingEntry && canEditDirectly ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="h-8 px-2"
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditingEntry(false);
                  setEditDescription(entry.description || "");
                  setEditProjectId(entry.projectId);
                }}
                className="h-8 px-2"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              {onPlay && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onPlay(groupedEntry.description || "", entry.projectId)}
                  className="h-8 w-8 p-0"
                >
                  {isTracking ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              )}
              
              {canEditDirectly && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsEditingEntry(true)}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onDelete(entry.id)}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Expanded session blocks */}
      {isExpanded && isGrouped && (
        <div className="bg-gray-50 border-t">
          {groupedEntry.blocks.map((block, index) => (
            <div key={block.id} className="flex items-center px-14 py-2 text-sm">
              <div className="flex-1 text-gray-600">
                Session {index + 1}
              </div>
              <div className="w-32 text-gray-500 font-mono">
                {block.startTime && block.endTime ? (
                  `${format(new Date(block.startTime), 'HH:mm')} - ${format(new Date(block.endTime), 'HH:mm')}`
                ) : (
                  "—"
                )}
              </div>
              <div className="w-24 text-gray-700 font-mono">
                {timeFormat === "decimal" 
                  ? `${parseFloat(block.duration || "0").toFixed(2)}h` 
                  : formatTimeFromDecimal(parseFloat(block.duration || "0"))
                }
              </div>
              <div className="w-32"></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}