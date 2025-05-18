import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Square } from "lucide-react";
import { formatTime } from "@/lib/utils/timeUtils";

interface SimpleTimerProps {
  description: string;
  projectId?: number;
  onStop: (data: { seconds: number, startTime: Date, endTime: Date }) => void;
  isDisabled: boolean;
}

export default function SimpleTimer({ 
  description, 
  projectId,
  onStop,
  isDisabled
}: SimpleTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const intervalRef = useRef<number | null>(null);
  
  // Check localStorage on mount to see if we have a running timer
  useEffect(() => {
    const storedTimer = localStorage.getItem("timeTracker");
    if (storedTimer) {
      try {
        const { startTime, description: storedDesc, projectId: storedProjectId } = JSON.parse(storedTimer);
        
        // Only restore if the current description and projectId match the stored one
        // This prevents restoring the wrong timer if the user changes projects
        if (description === storedDesc && projectId === storedProjectId && startTime) {
          const start = new Date(startTime);
          setStartTime(start);
          setIsRunning(true);
          
          // Calculate elapsed time
          const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);
          setTime(elapsed);
          
          // Start the interval
          intervalRef.current = window.setInterval(() => {
            setTime(prev => prev + 1);
          }, 1000);
        }
      } catch (error) {
        console.error("Error parsing stored timer:", error);
      }
    }
    
    // Clean up on unmount
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [description, projectId]);

  // Start the timer
  const handleStart = () => {
    if (isDisabled) return;
    
    console.log("Starting timer...");
    const now = new Date();
    setIsRunning(true);
    setStartTime(now);
    
    // Reset time to 0
    setTime(0);
    
    // Start the interval to update the time every second
    intervalRef.current = window.setInterval(() => {
      setTime(prev => prev + 1);
    }, 1000);
    
    // Store in localStorage to persist across page refreshes and tab changes
    localStorage.setItem("timeTracker", JSON.stringify({
      startTime: now.getTime(),
      description,
      projectId,
      clientId: window.selectedClientId // Add client ID to storage
    }));
  };

  // Stop the timer
  const handleStop = () => {
    if (!isRunning || !startTime) return;
    
    console.log("Stopping timer...");
    // Clear the interval
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Calculate duration
    const endTime = new Date();
    
    // Reset state
    setIsRunning(false);
    
    // Remove from localStorage
    localStorage.removeItem("timeTracker");
    
    // Call the onStop callback
    onStop({
      seconds: time,
      startTime: startTime,
      endTime: endTime
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="text"
        value={formatTime(time)}
        readOnly
        className="font-mono text-center w-28"
      />
      <Button
        onClick={isRunning ? handleStop : handleStart}
        disabled={isDisabled}
        variant={isRunning ? "destructive" : "default"}
        className={isRunning ? "bg-destructive" : "bg-accent"}
      >
        {isRunning ? (
          <>
            <Square className="mr-2 h-4 w-4" /> Stop
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" /> Start
          </>
        )}
      </Button>
    </div>
  );
}