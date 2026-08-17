import { and, desc, eq, gte, isNull, lte, not, or, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  clients,
  projects,
  timeEntries,
  type Client,
  type Project,
  type Settings,
  type TimeEntry,
} from "@shared/schema";
import { dateInTimeZone, entryHours, type EnrichedTimeEntry } from "@shared/time-summary";

/**
 * Server-side timer + entry helpers shared by `/api/v1` (token auth) and the
 * session-authenticated `/api/tracker/timer/*` mirrors used by the web app.
 *
 * A "running" timer is a `time_entries` row with `end_time IS NULL AND duration IS NULL`.
 * (Legacy manual entries may have a null end_time but always carry a duration.)
 */

export const runningEntryCondition = () => and(isNull(timeEntries.endTime), isNull(timeEntries.duration))!;
export const completedEntryCondition = () => not(runningEntryCondition());

export const isRunningEntry = (entry: Pick<TimeEntry, "endTime" | "duration">) =>
  entry.endTime === null && (entry.duration === null || entry.duration === undefined);

const RUNNING_TIMER_UNIQUE_INDEX = "time_entries_one_running_per_user";

const isRunningTimerConflict = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; constraint?: string; cause?: unknown };
  if (candidate.code === "23505" && candidate.constraint === RUNNING_TIMER_UNIQUE_INDEX) return true;
  return candidate.cause ? isRunningTimerConflict(candidate.cause) : false;
};

export async function getRunningEntry(userId: number): Promise<TimeEntry | null> {
  const [entry] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), runningEntryCondition()))
    .orderBy(desc(timeEntries.startTime), desc(timeEntries.id))
    .limit(1);
  return entry ?? null;
}

export type StartTimerInput = {
  projectId?: number | null;
  clientId?: number | null;
  description?: string | null;
  startTime?: Date;
  /** IANA zone used to derive the entry `date`; defaults to UTC */
  timeZone?: string | null;
  date?: string;
};

export type StopTimerInput = {
  endTime?: Date;
  /** override the running entry's start (the browser sends its own start when it stops) */
  startTime?: Date;
  description?: string | null;
  projectId?: number | null;
  clientId?: number | null;
  billable?: boolean;
  timeZone?: string | null;
  date?: string;
};

/** Stops any running timer, then opens a new running entry. */
export async function startTimer(userId: number, input: StartTimerInput): Promise<{ entry: TimeEntry; stopped: TimeEntry | null }> {
  const startTime = input.startTime ?? new Date();
  // The partial unique index is the final guard against two browsers or API
  // callers opening timers simultaneously. If another start wins the race,
  // retry once so this (newer) request closes it and becomes the active timer.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const running = await getRunningEntry(userId);
    const stopped = running
      ? await completeRunningEntry(running, {
          endTime: startTime.getTime() > new Date(running.startTime).getTime() ? startTime : new Date(),
          timeZone: input.timeZone,
        })
      : null;

    try {
      const entry = await storage.createTimeEntry({
        userId,
        description: (input.description ?? "").trim(),
        projectId: input.projectId ?? null,
        clientId: input.projectId ? null : input.clientId ?? null,
        startTime,
        endTime: null,
        duration: null,
        date: input.date ?? dateInTimeZone(startTime, input.timeZone),
      } as any);
      return { entry, stopped };
    } catch (error) {
      if (attempt === 0 && isRunningTimerConflict(error)) continue;
      throw error;
    }
  }

  throw new Error("Could not establish a running timer");
}

/** Closes the running timer (if any) and returns the completed entry. */
export async function stopTimer(userId: number, input: StopTimerInput = {}): Promise<TimeEntry | null> {
  const running = await getRunningEntry(userId);
  if (!running) return null;
  return completeRunningEntry(running, input);
}

export async function completeRunningEntry(running: TimeEntry, input: StopTimerInput = {}): Promise<TimeEntry> {
  const start = input.startTime ?? new Date(running.startTime);
  let end = input.endTime ?? new Date();
  if (end.getTime() < start.getTime()) end = start;
  const durationHours = (end.getTime() - start.getTime()) / 3_600_000;

  const patch: Record<string, unknown> = {
    ...(input.startTime ? { startTime: start } : {}),
    endTime: end,
    duration: durationHours.toFixed(6),
    date: input.date ?? dateInTimeZone(start, input.timeZone),
  };
  if (input.description !== undefined && input.description !== null) patch.description = input.description.trim();
  if (input.projectId !== undefined) patch.projectId = input.projectId;
  if (input.clientId !== undefined) patch.clientId = input.clientId;
  if (input.projectId) patch.clientId = null;
  if (input.billable !== undefined) patch.billable = input.billable;

  const updated = await storage.updateTimeEntry(running.id, patch as any);
  return updated ?? { ...running, ...patch } as TimeEntry;
}

export type EntryListFilters = {
  from?: string;
  to?: string;
  clientId?: number;
  projectId?: number;
  limit?: number;
  includeRunning?: boolean;
  /** exclude entries already attached to an invoice */
  uninvoicedOnly?: boolean;
};

export type EntryJoinRow = { entry: TimeEntry; project: Project | null; client: Client | null };

/** Entries joined with project + (project's or direct) client, newest first. */
export async function listEntryRows(userId: number, filters: EntryListFilters = {}): Promise<EntryJoinRow[]> {
  const conditions = [eq(timeEntries.userId, userId)];
  if (filters.from) conditions.push(gte(timeEntries.date, filters.from));
  if (filters.to) conditions.push(lte(timeEntries.date, filters.to));
  if (filters.projectId) conditions.push(eq(timeEntries.projectId, filters.projectId));
  if (filters.clientId) {
    conditions.push(or(eq(projects.clientId, filters.clientId), eq(timeEntries.clientId, filters.clientId))!);
  }
  if (!filters.includeRunning) conditions.push(completedEntryCondition());
  if (filters.uninvoicedOnly) conditions.push(isNull(timeEntries.invoiceId));

  const limit = Math.min(Math.max(filters.limit ?? 500, 1), 2000);
  const rows = await db
    .select({ entry: timeEntries, project: projects, client: clients })
    .from(timeEntries)
    .leftJoin(projects, and(eq(timeEntries.projectId, projects.id), eq(projects.userId, userId)))
    .leftJoin(
      clients,
      and(
        eq(clients.id, sql`coalesce(${projects.clientId}, ${timeEntries.clientId})`),
        eq(clients.userId, userId),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(timeEntries.date), desc(timeEntries.startTime), desc(timeEntries.id))
    .limit(limit);
  return rows;
}

export function enrichEntry(
  row: EntryJoinRow,
  settings: Settings | undefined | null,
): EnrichedTimeEntry {
  const { entry, project, client } = row;
  const running = isRunningEntry(entry);
  const hours = running ? 0 : entryHours(entry);
  const hourlyRate = Number.parseFloat(project?.hourlyRate ?? "0") || 0;
  const currency = client?.currency || settings?.defaultCurrency || "USD";
  return {
    id: entry.id,
    description: entry.description,
    projectId: entry.projectId ?? null,
    projectName: project?.name ?? null,
    clientId: client?.id ?? entry.clientId ?? null,
    clientName: client?.name ?? null,
    startTime: new Date(entry.startTime).toISOString(),
    endTime: entry.endTime ? new Date(entry.endTime).toISOString() : null,
    hours: Number(hours.toFixed(6)),
    billable: entry.billable ?? true,
    hourlyRate,
    amount: Number((hours * hourlyRate).toFixed(2)),
    currency,
    date: entry.date,
    invoiceId: entry.invoiceId ?? null,
    running,
  };
}

/** Load a single entry with joins (ownership enforced by userId). */
export async function getEntryRow(userId: number, id: number): Promise<EntryJoinRow | null> {
  const [row] = await db
    .select({ entry: timeEntries, project: projects, client: clients })
    .from(timeEntries)
    .leftJoin(projects, and(eq(timeEntries.projectId, projects.id), eq(projects.userId, userId)))
    .leftJoin(
      clients,
      and(
        eq(clients.id, sql`coalesce(${projects.clientId}, ${timeEntries.clientId})`),
        eq(clients.userId, userId),
      ),
    )
    .where(and(eq(timeEntries.userId, userId), eq(timeEntries.id, id)))
    .limit(1);
  return row ?? null;
}
