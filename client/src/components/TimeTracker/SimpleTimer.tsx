import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Square } from "lucide-react";
import { formatTime } from "@/lib/utils/timeUtils";
import { useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  
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

  // Stop the timer with same-day merging logic
  const handleStop = async () => {
    if (!isRunning || !startTime) return;
    
    // Allow entries without projectId for manual tracking
    if (!projectId && !description.trim()) {
      console.log("Skipping save - no project selected and no description");
      setIsRunning(false);
      localStorage.removeItem("timeTracker");
      return;
    }
    
    console.log("Stopping timer...");
    
    // Clear the interval
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    const endTime = new Date();
    const diffMs = endTime.getTime() - startTime.getTime();
    const duration = diffMs / (1000 * 60 * 60); // Convert to hours
    
    // Save even very short sessions (no minimum duration)
    console.log(`Recording session: ${Math.floor(diffMs / 1000)} seconds (${duration.toFixed(6)} hours)`);
    
    console.log("Timer stopped with data:", {
      actualSeconds: Math.floor(diffMs / 1000),
      timerSeconds: time,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });
    
    console.log("Client calculated exact duration:", duration.toFixed(4), "hours from", diffMs, "ms (", Math.floor(diffMs / 1000), "actual seconds)");
    
    // Format dates for database
    const dateStr = startTime.toISOString().split('T')[0]; // YYYY-MM-DD
    const monthStr = startTime.toLocaleDateString('en-US', { month: 'long' });
    const yearNum = startTime.getFullYear();
    const weekNum = Math.ceil(startTime.getDate() / 7);
    const weekLabel = `Week ${weekNum}`;
    
    try {
      // Check for existing entry with same description, project, and date
      const response = await fetch("/api/time-entries");
      const existingEntries = await response.json();
      
      console.log("Checking for existing entries on date:", dateStr);
      console.log("Looking for description:", description, "projectId:", projectId);
      console.log("All existing entries:", existingEntries.map((e: any) => ({
        id: e.id,
        description: e.description,
        projectId: e.projectId,
        date: e.date
      })));
      
      const todayEntry = existingEntries.find((entry: any) => 
        entry.description === description &&
        entry.projectId === projectId &&
        entry.date === dateStr
      );
      
      console.log("Found existing entry:", todayEntry);
      
      if (todayEntry) {
        // Update existing entry by adding the new duration
        const existingDuration = parseFloat(todayEntry.duration || "0");
        const newTotalDuration = existingDuration + duration;
        
        console.log(`Updating existing entry ${todayEntry.id}: ${existingDuration}h + ${duration}h = ${newTotalDuration}h`);
        
        // Update the existing entry
        await fetch(`/api/time-entries/${todayEntry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: todayEntry.description,
            projectId: todayEntry.projectId,
            startTime: todayEntry.startTime,
            endTime: endTime.toISOString(),
            duration: newTotalDuration.toString(),
            date: todayEntry.date,
            month: todayEntry.month,
            year: todayEntry.year,
            weekNumber: todayEntry.weekNumber,
            weekLabel: todayEntry.weekLabel,
            billable: todayEntry.billable
          }),
        });
        
        console.log("Successfully updated existing entry");
        
        // Trigger green highlight for updated entry
        window.dispatchEvent(new CustomEvent('timeEntryHighlight', {
          detail: { entryId: todayEntry.id, type: 'updated' }
        }));
      } else {
        console.log("No existing entry found, creating new one");
        
        // Create new entry
        await fetch("/api/tracker/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description,
            projectId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: duration.toString(),
            date: dateStr,
            month: monthStr,
            year: yearNum,
            weekNumber: weekNum,
            weekLabel: weekLabel,
            billable: true,
          }),
        });
      }
      
      // Force cache refresh using React Query
      await queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      console.log("Cache invalidated successfully");
      
    } catch (error) {
      console.error("Error in same-day merging logic:", error);
      // Fallback to old behavior if there's an error
      onStop({
        seconds: time,
        startTime: startTime,
        endTime: endTime
      });
    }
    
    // Reset state and cleanup
    setIsRunning(false);
    localStorage.removeItem("timeTracker");
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
      {/* Timer display with no input field */}
      <div className="font-mono text-lg w-36 text-center border rounded-md p-2 bg-gray-50 select-none">
        {formatTimerDisplay(time)}
      </div>
      <Button 
        onClick={isRunning ? handleStop : handleStart}
        disabled={isDisabled}
        variant={isRunning ? "destructive" : "default"}
        className={isRunning ? "bg-destructive" : "bg-accent"}
        data-timer-start={!isRunning ? "true" : undefined}
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