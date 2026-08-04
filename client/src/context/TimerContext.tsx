import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  clearUserTimer,
  getTimerStorageKey,
  migrateLegacyTimerForUser,
  readUserTimer,
  saveUserTimer,
  StoredTimer,
} from "@/lib/timer-storage";

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
  stopTimer: () => Promise<boolean>;
  startTimerWithData: (desc: string, projectId: number, clientId?: number) => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>();
  const [currentDuration, setCurrentDuration] = useState(0);
  const activeUserIdRef = useRef<number | null>(null);
  const { toast } = useToast();
  const { user, isLoading } = useAuth();

  const resetTimerState = useCallback(() => {
    setIsTracking(false);
    setStartTime(null);
    setDescription("");
    setSelectedProjectId(undefined);
    setSelectedClientId(undefined);
    setCurrentDuration(0);
  }, []);

  const applyStoredTimer = useCallback((timer: StoredTimer | null) => {
    if (!timer) {
      resetTimerState();
      return;
    }

    setDescription(timer.description);
    setSelectedProjectId(timer.projectId);
    setSelectedClientId(timer.clientId);
    setStartTime(timer.startTime);
    setIsTracking(true);
  }, [resetTimerState]);

  useEffect(() => {
    let cancelled = false;
    const userId = user?.id;

    activeUserIdRef.current = userId || null;
    resetTimerState();

    if (isLoading || !userId) return () => { cancelled = true; };

    const restoreTimer = async () => {
      const storedTimer = readUserTimer(userId) || await migrateLegacyTimerForUser(userId);
      if (!cancelled && activeUserIdRef.current === userId) {
        applyStoredTimer(storedTimer);
      }
    };

    void restoreTimer();

    const syncTimer = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== getTimerStorageKey(userId)) return;
      if (event instanceof CustomEvent && event.detail?.userId !== userId) return;
      applyStoredTimer(readUserTimer(userId));
    };

    window.addEventListener("storage", syncTimer);
    window.addEventListener("tickdTimerChanged", syncTimer);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", syncTimer);
      window.removeEventListener("tickdTimerChanged", syncTimer);
    };
  }, [applyStoredTimer, isLoading, resetTimerState, user?.id]);

  useEffect(() => {
    if (!isTracking || !startTime) {
      setCurrentDuration(0);
      return;
    }

    const updateDuration = () => setCurrentDuration((Date.now() - startTime) / 1000);
    updateDuration();
    const interval = window.setInterval(updateDuration, 1000);
    return () => window.clearInterval(interval);
  }, [isTracking, startTime]);

  const startTimer = () => {
    if (!user?.id) return;

    const timer: StoredTimer = {
      ownerUserId: user.id,
      startTime: Date.now(),
      description,
      projectId: selectedProjectId,
      clientId: selectedClientId,
    };

    saveUserTimer(timer);
    applyStoredTimer(timer);
  };

  const startTimerWithData = (desc: string, projectId: number, clientId?: number) => {
    if (!user?.id) return;

    const timer: StoredTimer = {
      ownerUserId: user.id,
      startTime: Date.now(),
      description: desc,
      projectId,
      clientId: clientId || selectedClientId,
    };

    saveUserTimer(timer);
    applyStoredTimer(timer);
    toast({
      title: "Timer started",
      description: `Started tracking "${desc}"`,
    });
  };

  const stopTimer = async (): Promise<boolean> => {
    const userId = user?.id;
    if (!userId || !isTracking || !startTime || activeUserIdRef.current !== userId) return false;

    const storedTimer = readUserTimer(userId);
    if (!storedTimer || storedTimer.startTime !== startTime) {
      resetTimerState();
      toast({
        title: "Timer unavailable",
        description: "This timer does not belong to the current account.",
        variant: "destructive",
      });
      return false;
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000 / 3600;

    try {
      const response = await fetch("/api/tracker/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          projectId: selectedProjectId || null,
          clientId: selectedProjectId ? null : selectedClientId || null,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          duration: duration.toString(),
          date: formatLocalDate(new Date(startTime)),
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "Failed to save time entry");
      }

      clearUserTimer(userId);
      resetTimerState();
      window.dispatchEvent(new CustomEvent("timeEntryUpdated"));
      window.dispatchEvent(new CustomEvent("timerStateChanged", {
        detail: { isTracking: false, projectId: null, description: "", clientId: null },
      }));

      toast({
        title: "Time entry saved",
        description: `Tracked ${Math.round(duration * 3600)} seconds`,
      });
      return true;
    } catch (error) {
      console.error("Error saving time entry:", error);
      toast({
        title: "Error saving time entry",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      return false;
    }
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
      startTimerWithData,
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimerContext() {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error("useTimerContext must be used within a TimerProvider");
  }
  return context;
}
