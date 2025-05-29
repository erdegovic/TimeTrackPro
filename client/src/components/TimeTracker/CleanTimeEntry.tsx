import { useState } from "react";
import { Calendar, ChevronDown, ChevronRight, Edit, Copy, Trash2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
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

interface CleanTimeEntryProps {
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

export default function CleanTimeEntry({
  entry,
  clients,
  projects,
  timeFormat,
  onDelete,
  onPlay,
  onStop,
  isTracking = false,
  isGrouped = false
}: CleanTimeEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (hours: number) => {
    if (timeFormat === "decimal") {
      return `${hours.toFixed(2)}h`;
    } else {
      const totalMinutes = Math.round(hours * 60);
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
  };

  return (
    <div className="border-b border-gray-200 bg-white">
      {/* Mobile Layout - Two Rows to prevent overlap */}
      <div className="sm:hidden px-4 py-3">
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
              <div className="text-sm font-medium text-gray-900 leading-tight break-words">
                {entry.description}
              </div>
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
          <div className="flex-1 min-w-0">
            <div className="flex flex-col space-y-1">
              {/* Project and client info */}
              <div className="text-xs text-gray-500 truncate">
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
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-1 ml-3">
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
              onClick={() => console.log('Edit entry')}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-red-600 hover:text-white hover:bg-red-600"
              onClick={() => onDelete(entry.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop/Tablet Layout (single row) */}
      <div className="hidden sm:block">
        <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-center">
            {/* Expand/collapse button */}
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
                entry.blocks.length > 1 ? (
                  <div className="text-sm text-gray-400 font-medium">
                    {entry.blocks.length}
                  </div>
                ) : null
              )}
            </div>

            {/* Description */}
            <div className="flex-1 min-w-0 px-4">
              <div className="text-sm font-medium text-gray-900 truncate">
                {entry.description}
              </div>
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
            </div>

            {/* Time range display */}
            <div className="flex items-center space-x-4 text-sm">
              <div className="text-gray-500">
                {(() => {
                  const sortedBlocks = [...entry.blocks].sort((a, b) => 
                    a.startTime.getTime() - b.startTime.getTime()
                  );
                  const firstStart = sortedBlocks[0]?.startTime;
                  const lastEnd = sortedBlocks[sortedBlocks.length - 1]?.endTime;
                  return `${formatTime(firstStart)} - ${formatTime(lastEnd)}`;
                })()}
              </div>

              {/* Total duration */}
              <div className="font-mono font-medium text-gray-900 min-w-[80px] text-right">
                {formatDuration(entry.totalDuration)}
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-1">
                {onPlay && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${isTracking ? 'text-red-600 hover:text-white hover:bg-red-600' : 'text-green-600 hover:text-white hover:bg-green-600'}`}
                    onClick={() => {
                      if (isTracking && onStop) {
                        onStop();
                      } else if (onPlay && entry.project) {
                        onPlay(entry.description, entry.project.id);
                      }
                    }}
                  >
                    {isTracking ? (
                      <Square className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="h-4 w-4 fill-current" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-600 hover:text-white hover:bg-blue-600"
                  onClick={() => console.log('Edit entry')}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600 hover:text-white hover:bg-red-600"
                  onClick={() => onDelete(entry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded individual blocks */}
      {isGrouped && isExpanded && (
        <div className="bg-gray-50">
          {entry.blocks.map((block, index) => (
            <div key={block.id} className="flex items-center px-8 sm:px-14 py-2 border-t border-gray-200">
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