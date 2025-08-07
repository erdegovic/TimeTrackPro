import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

interface TimerContextType {
  isTracking: boolean;
  startTime: number | null;
  description: string;
  selectedProjectId: number | undefined;
  selectedClientId: number | undefined;
  currentDuration: number;
  
  setDescription: (desc: string) => void;
  setSelectedProjectId: (id: number | undefined) => void;
  setSelectedClientId: (id: number | undefined) => void;
  
  startTimer: () => void;
  stopTimer: () => Promise<void>;
  startTimerWithData: (desc: string, projectId: number, clientId?: number) => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>();
  const [currentDuration, setCurrentDuration] = useState(0);
  
  const { toast } = useToast();

  // Update duration every second when tracking
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTracking && startTime) {
      interval = setInterval(() => {
        setCurrentDuration((Date.now() - startTime) / 1000);
      }, 1000);
    } else {
      setCurrentDuration(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking, startTime]);

  // Load timer state from localStorage on mount
  useEffect(() => {
    try {
      const storedTimer = localStorage.getItem("timeTracker");
      console.log("[TimerContext] Loading stored timer:", storedTimer);
      if (storedTimer) {
        const parsedTimer = JSON.parse(storedTimer);
        console.log("[TimerContext] Parsed timer:", parsedTimer);
        if (parsedTimer.startTime) {
          console.log("[TimerContext] Restoring timer state with startTime:", parsedTimer.startTime);
          setDescription(parsedTimer.description || '');
          setSelectedProjectId(parsedTimer.projectId);
          setSelectedClientId(parsedTimer.clientId);
          setStartTime(parsedTimer.startTime);
          setIsTracking(true);
          console.log("[TimerContext] Timer state restored, isTracking will be true");
        }
      } else {
        console.log("[TimerContext] No stored timer found");
      }
    } catch (error) {
      console.error("Error restoring timer state:", error);
    }
  }, []);

  const startTimer = () => {
    const now = Date.now();
    setStartTime(now);
    setIsTracking(true);
    
    localStorage.setItem("timeTracker", JSON.stringify({
      startTime: now,
      description,
      projectId: selectedProjectId,
      clientId: selectedClientId
    }));
  };

  const startTimerWithData = (desc: string, projectId: number, clientId?: number) => {
    setDescription(desc);
    setSelectedProjectId(projectId);
    if (clientId) {
      setSelectedClientId(clientId);
    }
    
    const now = Date.now();
    setStartTime(now);
    setIsTracking(true);
    
    localStorage.setItem("timeTracker", JSON.stringify({
      startTime: now,
      description: desc,
      projectId: projectId,
      clientId: clientId || selectedClientId
    }));
    
    toast({
      title: "Timer started",
      description: `Started tracking "${desc}"`,
    });
  };

  const stopTimer = async (): Promise<void> => {
    if (!isTracking || !startTime) return;

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000 / 3600; // Convert to hours

    try {
      // No validation needed - projectId is now optional

      const response = await fetch("/api/tracker/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          projectId: selectedProjectId || null,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          duration: duration.toString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save time entry");
      }

      toast({
        title: "Time entry saved",
        description: `Tracked ${Math.round(duration * 3600)} seconds`,
      });

      // Force cache refresh to update totals immediately
      // Trigger a complete data refresh by dispatching a custom event
      window.dispatchEvent(new CustomEvent('timeEntryUpdated'));

      // Clear localStorage
      localStorage.removeItem("timeTracker");
    } catch (error) {
      console.error("Error saving time entry:", error);
      toast({
        title: "Error saving time entry",
        description: "Please try again",
        variant: "destructive",
      });
    }
    
    // Reset timer state
    setIsTracking(false);
    setStartTime(null);
    setCurrentDuration(0);
  };

  return (
    <TimerContext.Provider value={{
      isTracking,
      startTime,
      description,
      selectedProjectId,
      selectedClientId,
      currentDuration,
      setDescription,
      setSelectedProjectId,
      setSelectedClientId,
      startTimer,
      stopTimer,
      startTimerWithData
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimerContext() {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimerContext must be used within a TimerProvider');
  }
  return context;
}