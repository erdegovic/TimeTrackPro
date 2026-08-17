import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { apiTokenAuth } from "../middleware/api-token-auth";
import {
  enrichEntry,
  getEntryRow,
  getRunningEntry,
  isRunningEntry,
  listEntryRows,
  startTimer,
  stopTimer,
} from "../time-tracking";
import { buildTimeSummary, dateInTimeZone, type SummaryGroupBy } from "@shared/time-summary";
import type { Client, Project, Settings } from "@shared/schema";

/**
 * `/api/v1` — token-authenticated API for external agents (Atlas).
 * Every route is scoped to `req.apiUser.id`. Mounted in server/index.ts *outside*
 * the session / Origin-check chain, with its own rate limiter.
 */
const router = Router();

router.use(apiTokenAuth);

const userIdOf = (req: Request) => req.apiUser!.id;

const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    handler(req, res).catch(next);

const optionalId = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().int().positive().optional(),
);
const nullableId = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value === null ? null : Number(value)),
  z.number().int().positive().nullable().optional(),
);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const isoDateTime = z.string().datetime({ offset: true });
const timeZone = z.string().max(64).optional();

const parseDate = (value: string) => new Date(value);

const projectView = (project: Project, client: Client | undefined, settings: Settings | undefined) => ({
  id: project.id,
  name: project.name,
  description: project.description,
  active: project.active ?? true,
  color: project.color,
  hourlyRate: Number.parseFloat(project.hourlyRate ?? "0") || 0,
  currency: client?.currency || settings?.defaultCurrency || "USD",
  clientId: project.clientId,
  clientName: client?.name ?? null,
});

const clientView = (client: Client, settings: Settings | undefined) => ({
  id: client.id,
  name: client.name,
  email: client.email,
  currency: client.currency || settings?.defaultCurrency || "USD",
  color: client.color,
  country: client.country,
});

/** Verifies project/client belong to the user and are consistent with each other. */
async function validateRelations(userId: number, projectId?: number | null, clientId?: number | null): Promise<string | null> {
  const [project, client] = await Promise.all([
    projectId ? storage.getProject(projectId) : Promise.resolve(undefined),
    clientId ? storage.getClient(clientId) : Promise.resolve(undefined),
  ]);
  if (projectId && (!project || project.userId !== userId)) return "The selected project is not available to this account";
  if (clientId && (!client || client.userId !== userId)) return "The selected client is not available to this account";
  if (project && clientId && project.clientId !== clientId) return "The selected project does not belong to the selected client";
  return null;
}

const runningView = async (userId: number) => {
  const running = await getRunningEntry(userId);
  if (!running) return null;
  const row = await getEntryRow(userId, running.id);
  if (!row) return null;
  const settings = await storage.getSettings(userId);
  const enriched = enrichEntry(row, settings);
  return { ...enriched, elapsedSeconds: Math.max(0, Math.floor((Date.now() - new Date(row.entry.startTime).getTime()) / 1000)) };
};

// ─────────────────────────────── me ───────────────────────────────

router.get("/me", asyncRoute(async (req, res) => {
  const userId = userIdOf(req);
  const [user, settings] = await Promise.all([storage.getUser(userId), storage.getSettings(userId)]);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    defaultCurrency: settings?.defaultCurrency || "USD",
    subscriptionPlan: user.subscriptionPlan,
  });
}));

// ─────────────────────────── clients / projects ───────────────────────────

router.get("/clients", asyncRoute(async (req, res) => {
  const userId = userIdOf(req);
  const [list, settings] = await Promise.all([storage.getClientsByUser(userId), storage.getSettings(userId)]);
  res.json(list.map((client) => clientView(client, settings)).sort((a, b) => a.name.localeCompare(b.name)));
}));

router.get("/projects", asyncRoute(async (req, res) => {
  const userId = userIdOf(req);
  const activeResult = z.enum(["1", "0", "true", "false"]).optional().safeParse(
    req.query.active === undefined ? undefined : String(req.query.active),
  );
  if (!activeResult.success) return res.status(400).json({ message: "active must be 1 or 0" });
  const activeParam = activeResult.data;
  const [list, clientList, settings] = await Promise.all([
    storage.getProjectsByUser(userId),
    storage.getClientsByUser(userId),
    storage.getSettings(userId),
  ]);
  const clientsById = new Map(clientList.map((client) => [client.id, client]));
  let projectsOut = list;
  if (activeParam === "true" || activeParam === "1") projectsOut = list.filter((project) => project.active !== false);
  if (activeParam === "false" || activeParam === "0") projectsOut = list.filter((project) => project.active === false);
  res.json(
    projectsOut
      .map((project) => projectView(project, clientsById.get(project.clientId), settings))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}));

// ─────────────────────────────── timer ───────────────────────────────

router.get("/timer", asyncRoute(async (req, res) => {
  res.json({ running: await runningView(userIdOf(req)) });
}));

const startTimerSchema = z.object({
  projectId: nullableId,
  clientId: nullableId,
  description: z.string().trim().max(1000).optional(),
  startTime: isoDateTime.optional(),
  timeZone,
});

router.post("/timer/start", asyncRoute(async (req, res) => {
  const userId = userIdOf(req);
  const parsed = startTimerSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: "Invalid timer data", errors: parsed.error.errors });
  const relationError = await validateRelations(userId, parsed.data.projectId, parsed.data.clientId);
  if (relationError) return res.status(403).json({ message: relationError });

  const startTime = parsed.data.startTime ? parseDate(parsed.data.startTime) : new Date();
  const { entry, stopped } = await startTimer(userId, {
    projectId: parsed.data.projectId ?? null,
    clientId: parsed.data.clientId ?? null,
    description: parsed.data.description ?? "",
    startTime,
    timeZone: parsed.data.timeZone,
  });
  const settings = await storage.getSettings(userId);
  const stoppedRow = stopped ? await getEntryRow(userId, stopped.id) : null;
  res.status(201).json({
    running: await runningView(userId),
    entryId: entry.id,
    stopped: stoppedRow ? enrichEntry(stoppedRow, settings) : null,
  });
}));

const stopTimerSchema = z.object({
  endTime: isoDateTime.optional(),
  description: z.string().trim().max(1000).optional(),
  projectId: nullableId,
  clientId: nullableId,
  billable: z.boolean().optional(),
  timeZone,
});

router.post("/timer/stop", asyncRoute(async (req, res) => {
  const userId = userIdOf(req);
  const parsed = stopTimerSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: "Invalid timer data", errors: parsed.error.errors });
  if (parsed.data.projectId !== undefined || parsed.data.clientId !== undefined) {
    const relationError = await validateRelations(userId, parsed.data.projectId, parsed.data.clientId);
    if (relationError) return res.status(403).json({ message: relationError });
  }
  const stopped = await stopTimer(userId, {
    endTime: parsed.data.endTime ? parseDate(parsed.data.endTime) : undefined,
    description: parsed.data.description,
    projectId: parsed.data.projectId,
    clientId: parsed.data.clientId,
    billable: parsed.data.billable,
    timeZone: parsed.data.timeZone,
  });
  if (!stopped) return res.status(404).json({ message: "No timer is running", entry: null });
  const row = await getEntryRow(userId, stopped.id);
  const settings = await storage.getSettings(userId);
  res.json({ entry: row ? enrichEntry(row, settings) : null });
}));

// ─────────────────────────────── entries ───────────────────────────────

const listQuerySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    clientId: optionalId,
    projectId: optionalId,
    limit: z.coerce.number().int().min(1).max(2000).optional(),
    includeRunning: z.enum(["1", "true", "0", "false"]).optional(),
    uninvoicedOnly: z.enum(["1", "true", "0", "false"]).optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, { message: "from must not be after to" });

router.get("/time-entries", asyncRoute(async (req, res) => {
  const userId = userIdOf(req);
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid query", errors: parsed.error.errors });
  const q = parsed.data;
  const relationError = await validateRelations(userId, q.projectId, q.clientId);
  if (relationError) return res.status(403).json({ message: relationError });
  const [rows, settings] = await Promise.all([
    listEntryRows(userId, {
      from: q.from,
      to: q.to,
      clientId: q.clientId,
      projectId: q.projectId,
      limit: q.limit,
      includeRunning: q.includeRunning === "1" || q.includeRunning === "true",
      uninvoicedOnly: q.uninvoicedOnly === "1" || q.uninvoicedOnly === "true",
    }),
    storage.getSettings(userId),
  ]);
  res.json(rows.map((row) => enrichEntry(row, settings)));
}));

const createEntrySchema = z
  .object({
    description: z.string().trim().max(1000).optional().default(""),
    projectId: nullableId,
    clientId: nullableId,
    startTime: isoDateTime,
    endTime: isoDateTime.optional(),
    /** decimal hours; alternative to endTime */
    duration: z.coerce.number().positive().max(24 * 31).optional(),
    billable: z.boolean().optional(),
    date: isoDate.optional(),
    timeZone,
  })
  .refine((value) => Boolean(value.endTime) !== Boolean(value.duration), {
    message: "Provide exactly one of endTime or duration",
  });

router.post("/time-entries", asyncRoute(async (req, res) => {
  const userId = userIdOf(req);
  const parsed = createEntrySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: "Invalid time entry data", errors: parsed.error.errors });
  const body = parsed.data;
  const relationError = await validateRelations(userId, body.projectId, body.clientId);
  if (relationError) return res.status(403).json({ message: relationError });

  const start = parseDate(body.startTime);
  let end: Date;
  let hours: number;
  if (body.endTime) {
    end = parseDate(body.endTime);
    if (end.getTime() <= start.getTime()) return res.status(400).json({ message: "endTime must be after startTime" });
    hours = (end.getTime() - start.getTime()) / 3_600_000;
  } else {
    hours = body.duration!;
    end = new Date(start.getTime() + hours * 3_600_000);
  }
  if (hours > 24 * 31) return res.status(400).json({ message: "A time entry cannot exceed 31 days" });

  const created = await storage.createTimeEntry({
    userId,
    description: body.description,
    projectId: body.projectId ?? null,
    clientId: body.projectId ? null : body.clientId ?? null,
    startTime: start,
    endTime: end,
    duration: hours.toFixed(6),
    date: body.date ?? dateInTimeZone(start, body.timeZone),
  } as any);
  if (body.billable === false) await storage.updateTimeEntry(created.id, { billable: false } as any);

  const row = await getEntryRow(userId, created.id);
  const settings = await storage.getSettings(userId);
  res.status(201).json(row ? enrichEntry(row, settings) : { id: created.id });
}));

const patchEntrySchema = z
  .object({
    description: z.string().trim().max(1000).optional(),
    projectId: nullableId,
    clientId: nullableId,
    startTime: isoDateTime.optional(),
    endTime: isoDateTime.optional(),
    duration: z.coerce.number().positive().max(24 * 31).optional(),
    billable: z.boolean().optional(),
    date: isoDate.optional(),
    timeZone,
  })
  .refine((value) => !(value.endTime && value.duration), {
    message: "Provide endTime or duration, not both",
  });

router.patch("/time-entries/:id", asyncRoute(async (req, res) => {
  const userId = userIdOf(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid id" });
  const existing = await getEntryRow(userId, id);
  if (!existing) return res.status(404).json({ message: "Time entry not found" });

  const parsed = patchEntrySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: "Invalid time entry data", errors: parsed.error.errors });
  const body = parsed.data;
  const effectiveProjectId = body.projectId === undefined ? existing.entry.projectId : body.projectId;
  const requestedClientId = body.clientId === undefined
    ? (effectiveProjectId ? null : existing.entry.clientId)
    : body.clientId;
  const relationError = await validateRelations(userId, effectiveProjectId, requestedClientId);
  if (relationError) return res.status(403).json({ message: relationError });

  const patch: Record<string, unknown> = {};
  if (body.description !== undefined) patch.description = body.description;
  if (body.projectId !== undefined) patch.projectId = body.projectId;
  if (body.clientId !== undefined) patch.clientId = effectiveProjectId ? null : body.clientId;
  if (body.projectId) patch.clientId = null;
  if (body.billable !== undefined) patch.billable = body.billable;

  const start = body.startTime ? parseDate(body.startTime) : new Date(existing.entry.startTime);
  if (body.startTime) patch.startTime = start;
  const running = isRunningEntry(existing.entry);
  if (body.endTime) {
    const end = parseDate(body.endTime);
    if (end.getTime() <= start.getTime()) return res.status(400).json({ message: "endTime must be after startTime" });
    if (end.getTime() - start.getTime() > 31 * 24 * 3_600_000) {
      return res.status(400).json({ message: "A time entry cannot exceed 31 days" });
    }
    patch.endTime = end;
    patch.duration = ((end.getTime() - start.getTime()) / 3_600_000).toFixed(6);
  } else if (body.duration !== undefined) {
    patch.duration = body.duration.toFixed(6);
    patch.endTime = new Date(start.getTime() + body.duration * 3_600_000);
  } else if (body.startTime && !running && existing.entry.endTime) {
    const end = new Date(existing.entry.endTime);
    if (end.getTime() <= start.getTime()) return res.status(400).json({ message: "startTime must be before endTime" });
    const hours = (end.getTime() - start.getTime()) / 3_600_000;
    if (hours > 24 * 31) return res.status(400).json({ message: "A time entry cannot exceed 31 days" });
    patch.duration = hours.toFixed(6);
  }
  if (body.date) patch.date = body.date;
  else if (body.startTime) patch.date = dateInTimeZone(start, body.timeZone);

  if (Object.keys(patch).length === 0) return res.status(400).json({ message: "Nothing to update" });
  await storage.updateTimeEntry(id, patch as any);
  const row = await getEntryRow(userId, id);
  const settings = await storage.getSettings(userId);
  res.json(row ? enrichEntry(row, settings) : { id });
}));

router.delete("/time-entries/:id", asyncRoute(async (req, res) => {
  const userId = userIdOf(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid id" });
  const existing = await getEntryRow(userId, id);
  if (!existing) return res.status(404).json({ message: "Time entry not found" });
  if (existing.entry.invoiceId) return res.status(409).json({ message: "Entry is attached to an invoice; detach it in Tickd first" });
  await storage.deleteTimeEntry(id);
  res.json({ ok: true, id });
}));

// ─────────────────────────────── reports ───────────────────────────────

const summaryQuerySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    clientId: optionalId,
    projectId: optionalId,
    groupBy: z.enum(["project", "client", "day"]).optional().default("project"),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, { message: "from must not be after to" });

router.get("/reports/summary", asyncRoute(async (req, res) => {
  const userId = userIdOf(req);
  const parsed = summaryQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid query", errors: parsed.error.errors });
  const q = parsed.data;
  const relationError = await validateRelations(userId, q.projectId, q.clientId);
  if (relationError) return res.status(403).json({ message: relationError });
  const [rows, settings] = await Promise.all([
    listEntryRows(userId, { from: q.from, to: q.to, clientId: q.clientId, projectId: q.projectId, limit: 2000 }),
    storage.getSettings(userId),
  ]);
  const enriched = rows.map((row) => enrichEntry(row, settings));
  res.json(buildTimeSummary(enriched, q.groupBy as SummaryGroupBy, { from: q.from, to: q.to }));
}));

router.use((_req: Request, res: Response) => res.status(404).json({ message: "Not found" }));

router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[api/v1] request failed", error);
  res.status(500).json({ message: "Internal server error" });
});

export default router;
