export interface StoredTimer {
  ownerUserId: number;
  startTime: number;
  description: string;
  projectId?: number;
  clientId?: number;
}

const LEGACY_TIMER_KEY = "timeTracker";
const TIMER_KEY_PREFIX = "tickd:timer:";

export const getTimerStorageKey = (userId: number) => `${TIMER_KEY_PREFIX}${userId}`;

const parseTimer = (value: string | null): Partial<StoredTimer> | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || !Number.isFinite(Number(parsed.startTime))) {
      return null;
    }

    const parseOptionalId = (id: unknown) => {
      if (id === null || id === undefined || id === "") return undefined;
      const numericId = Number(id);
      return Number.isInteger(numericId) && numericId > 0 ? numericId : undefined;
    };

    return {
      ownerUserId: parseOptionalId(parsed.ownerUserId),
      startTime: Number(parsed.startTime),
      description: typeof parsed.description === "string" ? parsed.description : "",
      projectId: parseOptionalId(parsed.projectId),
      clientId: parseOptionalId(parsed.clientId),
    };
  } catch {
    return null;
  }
};

export const readUserTimer = (userId: number): StoredTimer | null => {
  const parsed = parseTimer(localStorage.getItem(getTimerStorageKey(userId)));
  if (!parsed || parsed.ownerUserId !== userId || !parsed.startTime) return null;
  return parsed as StoredTimer;
};

export const saveUserTimer = (timer: StoredTimer) => {
  localStorage.setItem(getTimerStorageKey(timer.ownerUserId), JSON.stringify(timer));
  window.dispatchEvent(new CustomEvent("tickdTimerChanged", { detail: { userId: timer.ownerUserId } }));
};

export const clearUserTimer = (userId: number) => {
  localStorage.removeItem(getTimerStorageKey(userId));
  window.dispatchEvent(new CustomEvent("tickdTimerChanged", { detail: { userId } }));
};

export const migrateLegacyTimerForUser = async (userId: number): Promise<StoredTimer | null> => {
  const legacyTimer = parseTimer(localStorage.getItem(LEGACY_TIMER_KEY));
  if (!legacyTimer?.startTime) return null;

  if (legacyTimer.ownerUserId && legacyTimer.ownerUserId !== userId) {
    return null;
  }

  let ownsTimerRelation = legacyTimer.ownerUserId === userId;

  if (!legacyTimer.ownerUserId) {
    const [projectsResponse, clientsResponse] = await Promise.all([
      fetch("/api/projects"),
      fetch("/api/clients"),
    ]);

    if (!projectsResponse.ok || !clientsResponse.ok) return null;

    const projects = await projectsResponse.json() as Array<{ id: number }>;
    const clients = await clientsResponse.json() as Array<{ id: number }>;
    const ownsProject = legacyTimer.projectId
      ? projects.some((project) => project.id === legacyTimer.projectId)
      : false;
    const ownsClient = legacyTimer.clientId
      ? clients.some((client) => client.id === legacyTimer.clientId)
      : false;

    ownsTimerRelation = ownsProject || ownsClient;
  }

  if (!ownsTimerRelation) return null;

  const migratedTimer: StoredTimer = {
    ownerUserId: userId,
    startTime: legacyTimer.startTime,
    description: legacyTimer.description || "",
    projectId: legacyTimer.projectId,
    clientId: legacyTimer.clientId,
  };

  saveUserTimer(migratedTimer);
  localStorage.removeItem(LEGACY_TIMER_KEY);
  return migratedTimer;
};
