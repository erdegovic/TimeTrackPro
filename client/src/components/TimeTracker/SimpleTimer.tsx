import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";
import { formatTime } from "@/lib/utils/timeUtils";
import { useQueryClient } from "@tanstack/react-query";
import { useTimerContext } from "@/context/TimerContext";

interface SimpleTimerProps {
  description: string;
  projectId?: number;
  clientId?: number;
  onStop: (data: { seconds: number, startTime: Date, endTime: Date }) => void;
  isDisabled: boolean;
}

export default function SimpleTimer({ 
  description, 
  projectId,
  clientId,
  onStop,
  isDisabled
}: SimpleTimerProps) {
  const { 
    isTracking, 
    currentDuration, 
    startTime,
    startTimer, 
    stopTimer 
  } = useTimerContext();
  
  const queryClient = useQueryClient();

  // Handle stop from this component
  const handleStop = async () => {
    if (!isTracking || !startTime) return;
    
    const endTime = new Date();
    const startTimeDate = new Date(startTime);
    const diffMs = endTime.getTime() - startTimeDate.getTime();
    const duration = diffMs / (1000 * 60 * 60); // Convert to hours
    
    // Use the context's stop timer function
    const saved = await stopTimer();
    if (!saved) return;
    
    // Call the parent's onStop callback with the session data
    onStop({
      seconds: Math.floor(diffMs / 1000),
      startTime: new Date(startTime),
      endTime: new Date()
    });
    
    // Invalidate time entries to refresh the list
    queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
  };

  // Handle start from this component
  const handleStart = () => {
    if (isDisabled) return;
    startTimer();
  };

  return (
    <div className="flex items-center gap-2">
      <div className="font-mono text-lg">
        {formatTime(Math.floor(currentDuration))}
      </div>
      
      {isTracking ? (
        <Button
          onClick={handleStop}
          size="sm"
          variant="destructive"
          className="flex items-center gap-1"
        >
          <Square className="h-3 w-3" />
          Stop
        </Button>
      ) : (
        <Button
          onClick={handleStart}
          size="sm"
          variant="default"
          className="flex items-center gap-1"
          disabled={isDisabled}
        >
          <Play className="h-3 w-3" />
          Start
        </Button>
      )}
    </div>
  );
}
