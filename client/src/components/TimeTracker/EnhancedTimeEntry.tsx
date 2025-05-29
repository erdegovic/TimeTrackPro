import { useState, useEffect } from "react";
import { Edit, Copy, Trash2, Play, Square, ChevronDown, ChevronRight, Calendar, Check, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTimerContext } from "@/context/TimerContext";
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
  allTimeEntries?: Array<TimeEntry & { client?: Client; project?: Project; }>;
}

export default function EnhancedTimeEntry({
  entry,
  sessionGroup,
  clients,
  projects,
  timeFormat,
  onDelete,
  onPlay,
  isNew = false,
  isTracking: timerIsActive = false,
  onStop,
  allTimeEntries = []
}: EnhancedTimeEntryProps) {
  const { toast } = useToast();
  const { isTracking: globalIsTracking, description: currentDescription, selectedProjectId, stopTimer, startTimerWithData } = useTimerContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const [groupedEntry, setGroupedEntry] = useState<GroupedTimeEntry | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingMainEntry, setEditingMainEntry] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [isEditingEntry, setIsEditingEntry] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [editClientId, setEditClientId] = useState<number | undefined>();
  const [editProjectId, setEditProjectId] = useState<number | undefined>();
  const [isMerging, setIsMerging] = useState(false);

  // Listen for timer state changes to force UI updates
  useEffect(() => {
    const handleTimerStateChange = (event: CustomEvent) => {
      setForceUpdate(prev => prev + 1);
    };

    const handleMergeAnimation = (event: CustomEvent) => {
      const { sourceEntryId, description, projectId, date } = event.detail;
      
      console.log('Merge animation event received for entry', entry.id, 'Event details:', event.detail);
      
      // Check if this entry is involved in the merge
      const isThisEntryInvolved = entry.id === sourceEntryId || 
        (entry.date === date && entry.description === description && entry.projectId === projectId);
      
      console.log('Is this entry involved in merge?', isThisEntryInvolved, 'Entry:', { id: entry.id, description: entry.description, projectId: entry.projectId, date: entry.date });
      
      if (isThisEntryInvolved) {
        console.log('Starting merge highlight for entry', entry.id);
        setIsMerging(true);
        // Keep highlighted for 5 seconds, then fade away slowly
        setTimeout(() => {
          console.log('Ending merge highlight for entry', entry.id);
          setIsMerging(false);
        }, 5000);
      }
    };

    window.addEventListener('timerStateChanged', handleTimerStateChange as EventListener);
    window.addEventListener('timeEntryMerging', handleMergeAnimation as EventListener);
    
    return () => {
      window.removeEventListener('timerStateChanged', handleTimerStateChange as EventListener);
      window.removeEventListener('timeEntryMerging', handleMergeAnimation as EventListener);
    };
  }, [entry.id, entry.date, entry.description, entry.projectId]);

  // Check if this entry is currently being tracked
  const isCurrentlyTracking = globalIsTracking && 
    selectedProjectId === groupedEntry?.project?.id && 
    currentDescription === groupedEntry?.description;

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
  }, [entry, sessionGroup, entry.startTime, entry.endTime, entry.duration]);

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

      // Extract the actual entry ID from the blockId (format: "block-{entryId}")
      const actualEntryId = blockId.replace('block-', '');
      
      console.log('Sending time update:', updateData);
      console.log('Updating block with ID:', actualEntryId);
      const response = await apiRequest("PUT", `/api/time-entries/${actualEntryId}`, updateData);
      console.log('Server response:', response);

      // Wait for server update before refreshing UI
      await queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      
      // Update local state after server confirms the change
      const updatedBlocks = groupedEntry.blocks.map(block => 
        block.id === blockId 
          ? { ...block, startTime: newStartTime, endTime: newEndTime, duration }
          : block
      );

      const newTotalDuration = updatedBlocks.reduce((sum, block) => sum + block.duration, 0);

      setGroupedEntry({
        ...groupedEntry,
        blocks: updatedBlocks,
        totalDuration: newTotalDuration
      });

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

  const handleDateChange = async (newDate: Date) => {
    if (!groupedEntry) return;

    try {
      const newDateString = format(newDate, 'yyyy-MM-dd');
      
      // For grouped entries, update all blocks to the new date
      if (groupedEntry.blocks.length > 1) {
        // Update all time entries in the group
        for (const block of groupedEntry.blocks) {
          const actualEntryId = block.id.replace('block-', '');
          await apiRequest("PUT", `/api/time-entries/${actualEntryId}`, {
            date: newDateString
          });
        }
      } else {
        // For individual entries, update the single entry
        await apiRequest("PUT", `/api/time-entries/${entry.id}`, {
          date: newDateString
        });
      }

      // Refresh the time entries list
      await queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      
      toast({
        title: "Date updated",
        description: `Time entry moved to ${format(newDate, 'MMM dd, yyyy')}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update date. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditEntry = () => {
    setEditDescription(groupedEntry?.description || "");
    setEditClientId(groupedEntry?.client?.id);
    setEditProjectId(groupedEntry?.project?.id);
    setIsEditingEntry(true);
  };

  const handleSaveEntry = async () => {
    if (!groupedEntry || !editDescription.trim()) return;

    try {
      // Check if this would create a merge by looking for existing entries
      const project = projects.find(p => p.id === editProjectId);
      console.log('Checking for merge. Edit data:', { description: editDescription.trim(), projectId: editProjectId, date: entry.date });
      console.log('Available entries:', allTimeEntries.map(e => ({ id: e.id, description: e.description, projectId: e.projectId, date: e.date })));
      
      const willMerge = allTimeEntries.some((existingEntry: any) => 
        existingEntry.id !== entry.id &&
        existingEntry.date === entry.date &&
        existingEntry.description === editDescription.trim() &&
        existingEntry.projectId === editProjectId
      );
      
      console.log('Will merge?', willMerge);

      // Update all blocks in the group with new details
      const updateData = {
        description: editDescription.trim(),
        projectId: editProjectId
      };

      // For grouped entries, update all blocks
      if (groupedEntry.blocks.length > 1) {
        for (const block of groupedEntry.blocks) {
          const actualEntryId = block.id.replace('block-', '');
          await apiRequest("PUT", `/api/time-entries/${actualEntryId}`, updateData);
        }
      } else {
        // For individual entries, update the single entry
        await apiRequest("PUT", `/api/time-entries/${entry.id}`, updateData);
      }

      // If merging will happen, trigger the merge animation before refresh
      if (willMerge) {
        console.log('Triggering merge animation for entry', entry.id);
        // Dispatch a custom event to trigger merge animation
        window.dispatchEvent(new CustomEvent('timeEntryMerging', {
          detail: {
            sourceEntryId: entry.id,
            description: editDescription.trim(),
            projectId: editProjectId,
            date: entry.date
          }
        }));
        
        // Small delay to let animation start
        setTimeout(async () => {
          // Refresh the time entries list to trigger potential merging
          await queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
        }, 100);
      } else {
        // Refresh immediately if no merge
        await queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      }
      
      setIsEditingEntry(false);
      toast({
        title: "Entry updated",
        description: willMerge ? "Time entries merged successfully!" : "Time entry has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update entry. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditingEntry(false);
    setEditDescription("");
    setEditClientId(undefined);
    setEditProjectId(undefined);
  };

  if (!groupedEntry) return null;

  const isGrouped = groupedEntry.blocks.length > 1;
  const canEditDirectly = !isGrouped;

  return (
    <div className={`border-b border-gray-200 transition-all duration-1000 ${isNew ? 'bg-green-50' : ''} ${isMerging ? 'bg-blue-100 border-blue-300 shadow-lg' : ''}`}>
      {/* Main entry row */}
      <div className={`flex items-center px-6 py-4 hover:bg-gray-50 transition-all duration-1000 ${isMerging ? 'bg-blue-50' : ''}`}>
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
          {isEditingEntry ? (
            <div className="space-y-2">
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What are you working on?"
                className="text-sm"
              />
              <div className="flex space-x-2">
                <Select value={editClientId?.toString() || ""} onValueChange={(value) => {
                  const clientId = value ? Number(value) : undefined;
                  setEditClientId(clientId);
                  setEditProjectId(undefined); // Reset project when client changes
                }}>
                  <SelectTrigger className="text-xs h-6">
                    <SelectValue placeholder="Client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={editProjectId?.toString() || ""} onValueChange={(value) => {
                  setEditProjectId(value ? Number(value) : undefined);
                }} disabled={!editClientId}>
                  <SelectTrigger className="text-xs h-6">
                    <SelectValue placeholder="Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.filter(p => p.clientId === editClientId).map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        <span style={{ color: (project as any).color || "#000000" }}>
                          {project.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm font-medium text-gray-900 truncate">
                {groupedEntry.description}
              </div>
              <div className="text-xs text-gray-500">

                {/* Always show project name with color */}
                {groupedEntry.project && (
                  <span style={{ color: groupedEntry.project.color || "#000000" }}>
                    {groupedEntry.project.name}
                  </span>
                )}
                {/* Always show client name if project exists (since all projects have clients) */}
                {groupedEntry.project && groupedEntry.client && (
                  <span className="ml-2">• {groupedEntry.client.name}</span>
                )}
                {/* Fallback: if no client data but we have project, find client from projects */}
                {groupedEntry.project && !groupedEntry.client && (() => {
                  const foundClient = clients.find(c => c.id === groupedEntry.project?.clientId);
                  return foundClient ? <span className="ml-2">• {foundClient.name}</span> : null;
                })()}
                
                {/* Show message when no project is assigned */}
                {!groupedEntry.project && (
                  <span className="text-gray-400 italic">No project assigned</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Time range display */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
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
            
            {/* Calendar icon for date selection */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                >
                  <Calendar className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={new Date(groupedEntry.date)}
                  onSelect={(date) => {
                    if (date) {
                      handleDateChange(date);
                    }
                  }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Total duration */}
          <div className="font-mono font-medium text-gray-900 min-w-[80px] text-right">
            {formatDuration(groupedEntry.totalDuration)}
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-1">
            {isEditingEntry ? (
              <>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-green-600 hover:text-white hover:bg-green-600"
                  onClick={handleSaveEntry}
                  title="Save changes"
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-white hover:bg-gray-500"
                  onClick={handleCancelEdit}
                  title="Cancel editing"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
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
                        // Find the project to get client ID for complete synchronization
                        const project = projects.find(p => p.id === groupedEntry.project?.id);
                        const clientId = project?.clientId;
                        
                        // Use the improved timer function directly
                        startTimerWithData(
                          groupedEntry.description, 
                          groupedEntry.project?.id || 0,
                          clientId
                        );
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
                  className="h-8 w-8 text-blue-600 hover:text-white hover:bg-blue-600"
                  onClick={handleEditEntry}
                  title="Edit entry"
                >
                  <Edit className="h-4 w-4" />
                </Button>
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
              </>
            )}
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

  // Update the display when startTime or endTime props change
  useEffect(() => {
    if (!isEditing) {
      // Force re-render of the button display when times change
      setStartInput(format(startTime, 'h:mmaa').toLowerCase());
      setEndInput(format(endTime, 'h:mmaa').toLowerCase());
    }
  }, [startTime, endTime, isEditing]);

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
      key={`${startTime.getTime()}-${endTime.getTime()}`} // Force re-render when times change
    >
      {formatTime(startTime)} - {formatTime(endTime)}
    </button>
  );
}