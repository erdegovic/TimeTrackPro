import { useState, useEffect } from "react";
import { Edit, Copy, Trash2, Play, Square, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { TimeEntry, Client, Project } from "@shared/schema";
import { format, parse, isValid } from "date-fns";

interface TimeBlock {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in hours
}

interface GroupedTimeEntry {
  id: number;
  description: string;
  project?: Project;
  client?: Client;
  blocks: TimeBlock[];
  totalDuration: number;
  date: string;
  isExpanded?: boolean;
}

interface EnhancedTimeEntryProps {
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
}

export default function EnhancedTimeEntry({
  entry,
  sessionGroup,
  clients,
  projects,
  timeFormat,
  onDelete,
  onPlay,
  isNew = false
}: EnhancedTimeEntryProps) {
  const { toast } = useToast();
  const { isTracking, description: currentDescription, selectedProjectId, stopTimer, startTimerWithData } = useTimeTracker();
  const [isExpanded, setIsExpanded] = useState(false);
  const [groupedEntry, setGroupedEntry] = useState<GroupedTimeEntry | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingMainEntry, setEditingMainEntry] = useState(false);

  // Check if this entry is currently being tracked
  const isCurrentlyTracking = isTracking && 
    selectedProjectId === entry.projectId && 
    currentDescription === entry.description;

  // Initialize grouped entry from session group or single entry
  useEffect(() => {
    const sessions = sessionGroup || [entry];
    
    if (sessions.length > 0 && sessions[0].startTime && sessions[0].endTime) {
      // Create blocks from all sessions in the group
      const blocks: TimeBlock[] = sessions
        .filter(session => session.startTime && session.endTime)
        .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
        .map((session, index) => {
          const startTime = new Date(session.startTime!);
          const endTime = new Date(session.endTime!);
          
          // Use stored duration, fallback to calculated
          let duration = parseFloat(session.duration?.toString() || "0");
          if (duration === 0 || isNaN(duration)) {
            duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          }
          
          return {
            id: `block-${session.id}`,
            startTime,
            endTime,
            duration
          };
        });

      const totalDuration = blocks.reduce((sum, block) => sum + block.duration, 0);
      const firstBlock = blocks[0];

      setGroupedEntry({
        id: entry.id,
        description: entry.description || "",
        project: entry.project,
        client: entry.client,
        blocks,
        totalDuration,
        date: entry.date || format(firstBlock.startTime, 'yyyy-MM-dd'),
        isExpanded: false
      });
    }
  }, [entry, sessionGroup]);

  const formatTime = (date: Date) => {
    return format(date, 'h:mmaa').toLowerCase();
  };

  const formatDuration = (hours: number) => {
    if (timeFormat === "decimal") {
      return `${hours.toFixed(2)}h`;
    } else {
      const totalSeconds = Math.round(hours * 3600);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      
      if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      } else if (m > 0) {
        return `${m}:${s.toString().padStart(2, '0')}`;
      }
      return `${s}s`;
    }
  };

  const parseTimeInput = (timeStr: string, baseDate: Date): Date => {
    try {
      // Parse various time formats like "2:30pm", "14:30", "2:30"
      let parsedTime: Date;
      
      if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
        // 12-hour format with AM/PM
        parsedTime = parse(timeStr, 'h:mmaa', baseDate);
        if (!isValid(parsedTime)) {
          parsedTime = parse(timeStr, 'h:mma', baseDate);
        }
      } else if (timeStr.includes(':')) {
        // 24-hour format or time without AM/PM
        const [hours, minutes] = timeStr.split(':').map(Number);
        parsedTime = new Date(baseDate);
        parsedTime.setHours(hours, minutes, 0, 0);
      } else {
        // Just a number, assume it's hours
        const hours = parseInt(timeStr);
        parsedTime = new Date(baseDate);
        parsedTime.setHours(hours, 0, 0, 0);
      }

      return isValid(parsedTime) ? parsedTime : baseDate;
    } catch (error) {
      return baseDate;
    }
  };

  const updateTimeBlock = async (blockId: string, newStartTime: Date, newEndTime: Date) => {
    if (!groupedEntry) return;

    const duration = (newEndTime.getTime() - newStartTime.getTime()) / (1000 * 60 * 60);
    
    if (duration <= 0) {
      toast({
        title: "Invalid time range",
        description: "End time must be after start time.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update the time entry in the database
      const updateData = {
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString(),
        duration: duration.toFixed(6)
      };

      await apiRequest("PUT", `/api/time-entries/${entry.id}`, updateData);

      // Update local state immediately for instant UI feedback
      const updatedBlocks = groupedEntry.blocks.map(block => 
        block.id === blockId 
          ? { ...block, startTime: newStartTime, endTime: newEndTime, duration }
          : block
      );

      const newTotalDuration = updatedBlocks.reduce((sum, block) => sum + block.duration, 0);

      // Update local state first
      setGroupedEntry({
        ...groupedEntry,
        blocks: updatedBlocks,
        totalDuration: newTotalDuration
      });

      // Refresh data from server but don't overwrite local changes immediately
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });

      toast({
        title: "Time updated",
        description: `Duration updated to ${formatDuration(duration)}.`,
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
      const { id, ...entryWithoutId } = entry;
      await apiRequest("POST", "/api/time-entries", entryWithoutId);
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

  if (!groupedEntry) return null;

  const isGrouped = groupedEntry.blocks.length > 1;
  const canEditDirectly = !isGrouped;

  return (
    <div className={`border-b border-gray-200 ${isNew ? 'bg-green-50' : ''}`}>
      {/* Main entry row */}
      <div className="flex items-center px-6 py-4 hover:bg-gray-50">
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
            // Only show number if there are multiple blocks
            groupedEntry.blocks.length > 1 ? (
              <div className="text-sm text-gray-400 font-medium">
                {groupedEntry.blocks.length}
              </div>
            ) : null
          )}
        </div>

        {/* Description */}
        <div className="flex-1 min-w-0 px-4">
          <div className="text-sm font-medium text-gray-900 truncate">
            {groupedEntry.description}
          </div>
          <div className="text-xs text-gray-500">
            <span style={{ color: groupedEntry.project?.color || "#000000" }}>
              {groupedEntry.project?.name}
            </span>
            {groupedEntry.client && (
              <span className="ml-2">• {groupedEntry.client.name}</span>
            )}
          </div>
        </div>

        {/* Time range display */}
        <div className="flex items-center space-x-4 text-sm">
          {canEditDirectly ? (
            <EditableTimeRange
              startTime={groupedEntry.blocks[0].startTime}
              endTime={groupedEntry.blocks[0].endTime}
              onUpdate={(start, end) => updateTimeBlock(groupedEntry.blocks[0].id, start, end)}
              isEditing={editingMainEntry}
              onEditToggle={setEditingMainEntry}
            />
          ) : (
            <div className="text-gray-500">
              {(() => {
                const sortedBlocks = [...groupedEntry.blocks].sort((a, b) => 
                  a.startTime.getTime() - b.startTime.getTime()
                );
                const firstStart = sortedBlocks[0]?.startTime;
                const lastEnd = sortedBlocks[sortedBlocks.length - 1]?.endTime;
                return `${formatTime(firstStart)} - ${formatTime(lastEnd)}`;
              })()}
            </div>
          )}

          {/* Total duration */}
          <div className="font-mono font-medium text-gray-900 min-w-[80px] text-right">
            {formatDuration(groupedEntry.totalDuration)}
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-1">
            {onPlay && (
              <Button 
                variant="ghost" 
                size="icon"
                className={isCurrentlyTracking ? 
                  "h-8 w-8 text-red-600 hover:text-white hover:bg-red-600" : 
                  "h-8 w-8 text-green-600 hover:text-white hover:bg-green-600"
                }
                onClick={() => {
                  if (isCurrentlyTracking) {
                    stopTimer();
                  } else {
                    onPlay(groupedEntry.description, groupedEntry.project?.id || 0);
                  }
                }}
                title={isCurrentlyTracking ? "Stop tracking" : "Continue tracking this task"}
              >
                {isCurrentlyTracking ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-gray-500 hover:text-white hover:bg-gray-500"
              onClick={handleDuplicate}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-destructive hover:text-white hover:bg-destructive"
              onClick={() => onDelete(groupedEntry.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded individual blocks */}
      {isGrouped && isExpanded && (
        <div className="bg-gray-50">
          {groupedEntry.blocks.map((block, index) => (
            <div key={block.id} className="flex items-center px-14 py-2 border-t border-gray-200">
              <div className="flex-1 text-xs text-gray-500">
                Block {index + 1}
              </div>
              
              <div className="flex items-center space-x-4 text-sm">
                <EditableTimeRange
                  startTime={block.startTime}
                  endTime={block.endTime}
                  onUpdate={(start, end) => updateTimeBlock(block.id, start, end)}
                  isEditing={editingBlockId === block.id}
                  onEditToggle={(editing) => setEditingBlockId(editing ? block.id : null)}
                />
                
                <div className="font-mono text-gray-600 min-w-[80px] text-right">
                  {formatDuration(block.duration)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Component for editable time ranges
function EditableTimeRange({ 
  startTime, 
  endTime, 
  onUpdate, 
  isEditing, 
  onEditToggle 
}: {
  startTime: Date;
  endTime: Date;
  onUpdate: (start: Date, end: Date) => void;
  isEditing: boolean;
  onEditToggle: (editing: boolean) => void;
}) {
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");

  useEffect(() => {
    if (isEditing) {
      setStartInput(format(startTime, 'h:mmaa').toLowerCase());
      setEndInput(format(endTime, 'h:mmaa').toLowerCase());
    }
  }, [isEditing, startTime, endTime]);

  const handleSave = () => {
    const baseDate = new Date(startTime);
    const newStart = parseTimeInput(startInput, baseDate);
    const newEnd = parseTimeInput(endInput, baseDate);
    
    onUpdate(newStart, newEnd);
    onEditToggle(false);
  };

  const handleCancel = () => {
    onEditToggle(false);
  };

  const parseTimeInput = (timeStr: string, baseDate: Date): Date => {
    try {
      let parsedTime: Date;
      
      if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
        parsedTime = parse(timeStr, 'h:mmaa', baseDate);
        if (!isValid(parsedTime)) {
          parsedTime = parse(timeStr, 'h:mma', baseDate);
        }
      } else if (timeStr.includes(':')) {
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]) || 0;
        parsedTime = new Date(baseDate);
        parsedTime.setHours(hours, minutes, 0, 0);
      } else {
        const hours = parseInt(timeStr);
        parsedTime = new Date(baseDate);
        parsedTime.setHours(hours, 0, 0, 0);
      }

      return isValid(parsedTime) ? parsedTime : baseDate;
    } catch (error) {
      return baseDate;
    }
  };

  const formatTime = (date: Date) => {
    return format(date, 'h:mmaa').toLowerCase();
  };

  if (isEditing) {
    return (
      <div className="flex items-center space-x-2">
        <Input
          value={startInput}
          onChange={(e) => setStartInput(e.target.value)}
          className="w-20 h-7 text-xs"
          placeholder="6:33pm"
        />
        <span className="text-gray-400">-</span>
        <Input
          value={endInput}
          onChange={(e) => setEndInput(e.target.value)}
          className="w-20 h-7 text-xs"
          placeholder="7:46pm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <Button size="sm" onClick={handleSave} className="h-7 px-2 text-xs">
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel} className="h-7 px-2 text-xs">
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={() => onEditToggle(true)}
      className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded text-sm"
    >
      {formatTime(startTime)} - {formatTime(endTime)}
    </button>
  );
}