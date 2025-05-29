import { useState } from "react";
import { Calendar, ChevronDown, ChevronRight, Edit, Copy, Trash2, Play, Square, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { formatDuration } from "@/lib/utils/timeUtils";
import { TimeEntry, Client, Project } from "@shared/schema";

interface GroupedTimeEntry {
  id: number;
  description: string;
  project?: Project;
  client?: Client;
  blocks: Array<{
    id: string;
    startTime: Date;
    endTime: Date;
    duration: number;
  }>;
  totalDuration: number;
  date: string;
  isExpanded?: boolean;
}

interface MobileTimeEntryProps {
  entry: GroupedTimeEntry;
  clients: Client[];
  projects: Project[];
  timeFormat: "decimal" | "time";
  onDelete: (id: number) => void;
  onPlay?: (description: string, projectId: number) => void;
  onStop?: () => void;
  isTracking?: boolean;
  isGrouped?: boolean;
}

export default function MobileTimeEntry({
  entry,
  clients,
  projects,
  timeFormat,
  onDelete,
  onPlay,
  onStop,
  isTracking = false,
  isGrouped = false
}: MobileTimeEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(entry.description);
  const [editClientId, setEditClientId] = useState<number | undefined>(entry.client?.id);
  const [editProjectId, setEditProjectId] = useState<number | undefined>(entry.project?.id);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditDescription(entry.description);
    setEditClientId(entry.client?.id);
    setEditProjectId(entry.project?.id);
    setIsEditing(false);
  };

  return (
    <div className="border-b border-gray-200 bg-white">
      {/* Mobile Layout - Two Rows */}
      <div className="px-4 py-3">
        {/* First Row: Expand button, description, and duration */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start flex-1 min-w-0">
            {/* Expand/collapse button */}
            <div className="w-6 flex justify-center mt-1 mr-3 flex-shrink-0">
              {isGrouped ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-0 h-5 w-5"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              ) : (
                entry.blocks.length > 1 ? (
                  <div className="text-xs text-gray-400 font-medium">
                    {entry.blocks.length}
                  </div>
                ) : null
              )}
            </div>

            {/* Description */}
            <div className="flex-1 min-w-0">
              {isEditing ? (
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
                      setEditProjectId(undefined);
                    }}>
                      <SelectTrigger className="text-xs h-7">
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
                      <SelectTrigger className="text-xs h-7">
                        <SelectValue placeholder="Project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.filter(p => p.clientId === editClientId).map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            <span style={{ color: project.color || "#000000" }}>
                              {project.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="text-sm font-medium text-gray-900 leading-tight">
                  {entry.description}
                </div>
              )}
            </div>
          </div>

          {/* Duration - fixed on the right */}
          <div className="ml-4 flex-shrink-0">
            <div className="font-mono font-medium text-gray-900 text-sm">
              {formatDuration(entry.totalDuration)}
            </div>
          </div>
        </div>

        {/* Second Row: Project info, time range, and actions */}
        <div className="flex items-center justify-between">
          {/* Left side: Project info and time range */}
          <div className="flex-1 min-w-0">
            {!isEditing && (
              <div className="flex flex-col space-y-1">
                {/* Project and client info */}
                <div className="text-xs text-gray-500">
                  {entry.project && (
                    <span style={{ color: entry.project.color || "#000000" }}>
                      {entry.project.name}
                    </span>
                  )}
                  {entry.project && entry.client && (
                    <span className="ml-2">• {entry.client.name}</span>
                  )}
                  {!entry.project && (
                    <span className="text-gray-400 italic">No project assigned</span>
                  )}
                </div>

                {/* Time range */}
                <div className="flex items-center space-x-2">
                  <div className="text-xs text-gray-500">
                    {(() => {
                      const sortedBlocks = [...entry.blocks].sort((a, b) => 
                        a.startTime.getTime() - b.startTime.getTime()
                      );
                      const firstStart = sortedBlocks[0]?.startTime;
                      const lastEnd = sortedBlocks[sortedBlocks.length - 1]?.endTime;
                      return `${formatTime(firstStart)} - ${formatTime(lastEnd)}`;
                    })()}
                  </div>
                  
                  {/* Calendar icon */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600"
                      >
                        <Calendar className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={new Date(entry.date)}
                        onSelect={(date) => {
                          if (date) {
                            // TODO: Handle date change
                            console.log('Date changed:', date);
                          }
                        }}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>

          {/* Right side: Action buttons */}
          <div className="flex items-center space-x-1 ml-4">
            {isEditing ? (
              <>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-7 w-7 p-0 text-green-600 hover:text-white hover:bg-green-600"
                  onClick={handleSave}
                >
                  <Save className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-7 w-7 p-0 text-gray-500 hover:text-white hover:bg-gray-500"
                  onClick={handleCancel}
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                {onPlay && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 w-7 p-0 ${isTracking ? 'text-red-600 hover:text-white hover:bg-red-600' : 'text-green-600 hover:text-white hover:bg-green-600'}`}
                    onClick={() => {
                      if (isTracking && onStop) {
                        onStop();
                      } else if (onPlay && entry.project) {
                        onPlay(entry.description, entry.project.id);
                      }
                    }}
                  >
                    {isTracking ? (
                      <Square className="h-3 w-3 fill-current" />
                    ) : (
                      <Play className="h-3 w-3 fill-current" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-blue-600 hover:text-white hover:bg-blue-600"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-gray-600 hover:text-white hover:bg-gray-600"
                  onClick={() => console.log('Copy entry')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-600 hover:text-white hover:bg-red-600"
                  onClick={() => onDelete(entry.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expanded individual blocks */}
      {isGrouped && isExpanded && (
        <div className="bg-gray-50">
          {entry.blocks.map((block, index) => (
            <div key={block.id} className="flex items-center px-8 py-2 border-t border-gray-200">
              <div className="flex-1 text-xs text-gray-500">
                Block {index + 1}
              </div>
              
              <div className="flex items-center space-x-3 text-sm">
                <div className="text-xs text-gray-500">
                  {formatTime(block.startTime)} - {formatTime(block.endTime)}
                </div>
                <div className="font-mono text-xs text-gray-600 min-w-[60px] text-right">
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