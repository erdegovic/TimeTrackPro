import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Square } from "lucide-react";
import { formatTime } from "@/lib/utils/timeUtils";

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
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const intervalRef = useRef<number | null>(null);
  
  // Check localStorage on mount to see if we have a running timer
  useEffect(() => {
    // Check for a running timer in localStorage
    const checkForRunningTimer = () => {
      const storedTimer = localStorage.getItem("timeTracker");
      if (storedTimer) {
        try {
          const { startTime } = JSON.parse(storedTimer);
          
          // Always restore the timer if it exists
          // This ensures the timer continues when returning to the tab
          if (startTime) {
            const start = new Date(startTime);
            setStartTime(start);
            setIsRunning(true);
            
            // Calculate elapsed time
            const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);
            setTime(elapsed);
            
            // Start the interval
            if (intervalRef.current) {
              window.clearInterval(intervalRef.current);
            }
            
            intervalRef.current = window.setInterval(() => {
              setTime(prev => prev + 1);
            }, 1000);
            
            console.log("Timer restored with elapsed time:", formatTime(elapsed));
          }
        } catch (error) {
          console.error("Error parsing stored timer:", error);
        }
      }
    };

    // Initial check
    checkForRunningTimer();
    
    // Set up visibility change listener to refresh timer when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForRunningTimer();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up on unmount
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
      clientId
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

  // Format the time to a string in HH:MM:SS format
  const formatTimerDisplay = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Input 
          type="text" 
          placeholder="What are you working on?" 
          className="w-full"
          value={description}
          readOnly
          disabled={isDisabled}
        />
      </div>
      <div className="font-mono text-lg w-36 text-center border rounded-md p-2 bg-gray-50 select-none">
        {formatTimerDisplay(time)}
      </div>
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