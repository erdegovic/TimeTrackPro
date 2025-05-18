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

  // Clean up the interval when the component unmounts
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Start the timer
  const handleStart = () => {
    if (isDisabled) return;
    
    console.log("Starting timer...");
    setIsRunning(true);
    setStartTime(new Date());
    
    // Reset time to 0
    setTime(0);
    
    // Start the interval to update the time every second
    intervalRef.current = window.setInterval(() => {
      setTime(prev => prev + 1);
    }, 1000);
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