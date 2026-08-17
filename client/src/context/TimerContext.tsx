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
import { formatTime, formatTimerTitle } from "@/lib/utils/timeUtils";

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const localTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

/** Running server-side timer as returned by GET /api/tracker/timer. */
interface ServerTimer {
  id: number;
  description: string | null;
  projectId: number | null;
  clientId: number | null;
  startTime: string;
}

const RECONCILE_INTERVAL_MS = 60_000;

/** undefined = could not reach the server (offline / error); null = nothing running. */
const fetchServerTimer = async (): Promise<ServerTimer | null | undefined> => {
  try {
    const response = await fetch("/api/tracker/timer", { credentials: "include" });
    if (!response.ok) return undefined;
    const data = await response.json() as { running: ServerTimer | null };
    return data.running ?? null;
  } catch {
    return undefined;
  }
};

const serverTimerToStored = (userId: number, timer: ServerTimer): StoredTimer => ({
  ownerUserId: userId,
  startTime: new Date(timer.startTime).getTime(),
  description: timer.description ?? "",
  projectId: timer.projectId ?? undefined,
  clientId: timer.clientId ?? undefined,
  serverEntryId: timer.id,
});

/** Registers a (browser) timer as the running server-side entry. Returns the server id or null. */
const registerServerTimer = async (timer: StoredTimer): Promise<number | null> => {
  try {
    const response = await fetch("/api/tracker/timer/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        description: timer.description,
        projectId: timer.projectId ?? null,
        clientId: timer.projectId ? null : timer.clientId ?? null,
        startTime: new Date(timer.startTime).toISOString(),
        date: formatLocalDate(new Date(timer.startTime)),
        timeZone: localTimeZone(),
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { running?: { id?: number } };
    return typeof data.running?.id === "number" ? data.running.id : null;
  } catch {
    return null;
  }
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
  const registrationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRegistrationRef = useRef<{ startTime: number; promise: Promise<number | null> } | null>(null);
  // startTime of the timer currently applied to state (null = idle); lets the
  // periodic server reconcile avoid clobbering in-progress edits.
  const appliedStartTimeRef = useRef<number | null>(null);
  const defaultDocumentTitleRef = useRef(typeof document === "undefined" ? "Tickd" : document.title);
  const { toast } = useToast();
  const { user, isLoading } = useAuth();

  const resetTimerState = useCallback(() => {
    appliedStartTimeRef.current = null;
    setIsTracking(false);
    setStartTime(null);
    setDescription("");
    setSelectedProjectId(undefined);
    setSelectedClientId(undefined);
    setCurrentDuration(0);
  }, []);

  const applyStoredTimer = useCallback((timer: StoredTimer | null) => {
    appliedStartTimeRef.current = timer?.startTime ?? null;
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
    pendingRegistrationRef.current = null;
    resetTimerState();

    if (isLoading || !userId) return () => { cancelled = true; };

    // The server-side running entry is the source of truth (Atlas and other
    // devices can start/stop it). Browser storage is a cache of it.
    const runReconciliation = async (allowLegacyMigration: boolean) => {
      const storedTimer = readUserTimer(userId)
        || (allowLegacyMigration ? await migrateLegacyTimerForUser(userId) : null);
      const serverTimer = await fetchServerTimer();
      if (cancelled || activeUserIdRef.current !== userId) return;

      if (serverTimer === undefined) {
        // Offline / server error: keep whatever the browser has.
        if (storedTimer && appliedStartTimeRef.current !== storedTimer.startTime) applyStoredTimer(storedTimer);
        return;
      }

      if (serverTimer) {
        const timer = serverTimerToStored(userId, serverTimer);
        if (!storedTimer || storedTimer.serverEntryId !== serverTimer.id) {
          saveUserTimer(timer);
        }
        // State is reset before this first fetch. Apply the server timer even
        // when the browser cache already references the same server row.
        if (appliedStartTimeRef.current !== timer.startTime) {
          applyStoredTimer(timer);
        }
        return;
      }

      // Nothing is running on the server (and nothing stored here either).
      if (!storedTimer) return;
      if (storedTimer.serverEntryId) {
        // It was registered on the server and is gone now: stopped elsewhere.
        clearUserTimer(userId);
        resetTimerState();
        window.dispatchEvent(new CustomEvent("timeEntryUpdated"));
        toast({ title: "Timer stopped", description: "This timer was stopped from another device or by Atlas." });
        return;
      }
      // Browser-only timer from before server-side timers existed: register it.
      const serverEntryId = await registerServerTimer(storedTimer);
      if (cancelled || activeUserIdRef.current !== userId) return;
      const timer = serverEntryId ? { ...storedTimer, serverEntryId } : storedTimer;
      if (serverEntryId) saveUserTimer(timer);
      if (appliedStartTimeRef.current !== timer.startTime) applyStoredTimer(timer);
    };

    let reconciliation: Promise<void> | null = null;
    const reconcileWithServer = (allowLegacyMigration: boolean) => {
      if (reconciliation) return reconciliation;
      reconciliation = runReconciliation(allowLegacyMigration).finally(() => {
        reconciliation = null;
      });
      return reconciliation;
    };

    void reconcileWithServer(true);

    const reconcileOnFocus = () => {
      if (document.visibilityState === "visible") void reconcileWithServer(false);
    };
    window.addEventListener("focus", reconcileOnFocus);
    document.addEventListener("visibilitychange", reconcileOnFocus);
    const reconcileInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") void reconcileWithServer(false);
    }, RECONCILE_INTERVAL_MS);

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
      window.removeEventListener("focus", reconcileOnFocus);
      document.removeEventListener("visibilitychange", reconcileOnFocus);
      window.clearInterval(reconcileInterval);
    };
  }, [applyStoredTimer, isLoading, resetTimerState, toast, user?.id]);

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

  useEffect(() => {
    document.title = isTracking
      ? formatTimerTitle(currentDuration)
      : defaultDocumentTitleRef.current;
  }, [currentDuration, isTracking]);

  useEffect(() => () => {
    document.title = defaultDocumentTitleRef.current;
  }, []);

  // Save locally first (instant UI), then register the running entry on the
  // server so Atlas / other devices see it. If the server call fails the timer
  // keeps running locally and is registered on the next reconcile.
  const beginTimer = (timer: StoredTimer) => {
    saveUserTimer(timer);
    applyStoredTimer(timer);

    const registration = registrationQueueRef.current.then(() => {
      if (activeUserIdRef.current !== timer.ownerUserId) return null;
      return registerServerTimer(timer);
    });
    registrationQueueRef.current = registration.then(() => undefined, () => undefined);
    pendingRegistrationRef.current = { startTime: timer.startTime, promise: registration };

    void registration.then((serverEntryId) => {
      if (!serverEntryId) return;
      const current = readUserTimer(timer.ownerUserId);
      if (!current || current.startTime !== timer.startTime) return;
      saveUserTimer({ ...current, serverEntryId });
    }).finally(() => {
      if (pendingRegistrationRef.current?.startTime === timer.startTime) {
        pendingRegistrationRef.current = null;
      }
    });
  };

  const startTimer = () => {
    if (!user?.id) return;

    beginTimer({
      ownerUserId: user.id,
      startTime: Date.now(),
      description,
      projectId: selectedProjectId,
      clientId: selectedClientId,
    });
  };

  const startTimerWithData = (desc: string, projectId: number, clientId?: number) => {
    if (!user?.id) return;

    beginTimer({
      ownerUserId: user.id,
      startTime: Date.now(),
      description: desc,
      projectId,
      clientId: clientId || selectedClientId,
    });
    toast({
      title: "Timer started",
      description: `Started tracking "${desc}"`,
    });
  };

  const stopTimer = async (): Promise<boolean> => {
    const userId = user?.id;
    if (!userId || !isTracking || !startTime || activeUserIdRef.current !== userId) return false;

    let storedTimer = readUserTimer(userId);
    if (!storedTimer || storedTimer.startTime !== startTime) {
      resetTimerState();
      toast({
        title: "Timer unavailable",
        description: "This timer does not belong to the current account.",
        variant: "destructive",
      });
      return false;
    }

    const pendingRegistration = pendingRegistrationRef.current;
    if (pendingRegistration?.startTime === startTime) {
      await pendingRegistration.promise;
      if (activeUserIdRef.current !== userId) return false;
      storedTimer = readUserTimer(userId);
      // A newer timer was started while this stop was waiting. Leave it alone.
      if (!storedTimer || storedTimer.startTime !== startTime) return false;
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
          serverEntryId: storedTimer.serverEntryId,
        }),
        credentials: "include",
      });

      if (response.status === 409) {
        const latest = await fetchServerTimer();
        if (latest !== undefined) {
          if (latest) {
            const timer = serverTimerToStored(userId, latest);
            saveUserTimer(timer);
            applyStoredTimer(timer);
          } else {
            clearUserTimer(userId);
            resetTimerState();
          }
        }
      }

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
        description: `Tracked ${formatTime(Math.round(duration * 3600))}`,
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
