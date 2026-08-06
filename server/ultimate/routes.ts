import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import * as oidc from "openid-client";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../db";
import { authenticate } from "../middleware/auth";
import { storage } from "../storage";
import {
  aiArtifacts,
  clients,
  invoiceAutomationAudit,
  invoiceAutomationJobs,
  projects,
  recurringInvoiceSchedules,
  timeEntries,
} from "@shared/schema";
import { getUltimateCapabilities } from "@shared/subscriptions";
import { getNextMonthlyRun, getZonedDateRunAt } from "@shared/ultimate";
import {
  AiConfigurationError,
  AiQuotaError,
  getAiUsage,
  runStructuredAi,
  saveAiArtifact,
} from "../ai/service";
import {
  approveInvoiceJob,
  cancelInvoiceJob,
  getPreparedInvoicePreviewHtml,
  listAutomationData,
  prepareInvoiceJob,
  sendPreparedInvoice,
  updatePreparedInvoiceJob,
} from "./automation";
import { getBaseUrl } from "../utils/url-helper";
import {
  disconnectGmail,
  GMAIL_SEND_SCOPE,
  getGmailConnection,
  isGmailIntegrationConfigured,
  saveGmailConnection,
} from "../integrations/gmail";

const router = Router();
router.use(authenticate);
let gmailGoogleConfiguration: Promise<oidc.Configuration> | undefined;

const getGmailGoogleConfiguration = () => {
  if (!isGmailIntegrationConfigured()) throw new Error("Gmail delivery is not configured.");
  if (!gmailGoogleConfiguration) {
    gmailGoogleConfiguration = oidc.discovery(
      new URL("https://accounts.google.com"),
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
    );
  }
  return gmailGoogleConfiguration;
};

const saveSession = (req: Request) => new Promise<void>((resolve, reject) => {
  req.session.save((error) => error ? reject(error) : resolve());
});

const requireUltimate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await storage.getUser(req.user!.id);
    if (!user || !getUltimateCapabilities(user.subscriptionPlan, user.subscriptionStatus).canUseAi) {
      return res.status(403).json({ code: "ULTIMATE_REQUIRED", message: "Upgrade to Ultimate to use Smart Assistant." });
    }
    (req as any).accountUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requireAiConsent = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).accountUser;
  if (!user?.aiEnabled || !user?.aiDataConsentAt) {
    return res.status(412).json({ code: "AI_CONSENT_REQUIRED", message: "Enable AI assistance before sending selected work data for processing." });
  }
  next();
};

const sendRouteError = (res: Response, error: unknown) => {
  if (error instanceof z.ZodError) return res.status(400).json({ message: "Please check the submitted details.", errors: error.errors });
  if (error instanceof AiConfigurationError) return res.status(503).json({ code: "AI_NOT_CONFIGURED", message: error.message });
  if (error instanceof AiQuotaError) return res.status(429).json({ code: "AI_QUOTA_REACHED", message: error.message });
  const message = error instanceof Error ? error.message : "The request could not be completed.";
  if (/not found/i.test(message)) return res.status(404).json({ message });
  if (/required|choose|unavailable|no work|no uninvoiced|not awaiting|not ready|can no longer|acknowledge|invoice start|preparation date|one-time period|completed|already being sent|changed while/i.test(message)) {
    return res.status(400).json({ message });
  }
  console.error("Ultimate route failed:", error);
  return res.status(500).json({ message: "The request could not be completed." });
};

router.get("/status", requireUltimate, async (req, res) => {
  try {
    const user = (req as any).accountUser;
    const usage = await getAiUsage(req.user!.id);
    res.json({
      enabled: user.aiEnabled === true,
      consentedAt: user.aiDataConsentAt,
      configured: Boolean(process.env.OPENAI_API_KEY),
      usage,
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.get("/gmail/status", requireUltimate, async (req, res) => {
  try {
    const connection = await getGmailConnection(req.user!.id);
    res.json({
      configured: isGmailIntegrationConfigured(),
      connected: Boolean(connection),
      email: connection?.email || null,
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.get("/gmail/connect", requireUltimate, async (req, res) => {
  try {
    const configuration = await getGmailGoogleConfiguration();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    req.session.gmailOauthCodeVerifier = codeVerifier;
    req.session.gmailOauthState = state;
    req.session.gmailOauthNonce = nonce;
    await saveSession(req);
    const redirectUri = `${getBaseUrl(req)}/api/ultimate/gmail/callback`;
    const authorizationUrl = oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: redirectUri,
      scope: `openid email ${GMAIL_SEND_SCOPE}`,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      nonce,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
    });
    res.redirect(authorizationUrl.href);
  } catch (error) {
    console.error("Unable to start Gmail connection:", error);
    res.redirect("/ultimate?tab=automation&gmail=unavailable");
  }
});

router.get("/gmail/callback", requireUltimate, async (req, res) => {
  const codeVerifier = req.session.gmailOauthCodeVerifier;
  const expectedState = req.session.gmailOauthState;
  const expectedNonce = req.session.gmailOauthNonce;
  delete req.session.gmailOauthCodeVerifier;
  delete req.session.gmailOauthState;
  delete req.session.gmailOauthNonce;
  if (!codeVerifier || !expectedState || !expectedNonce) {
    return res.redirect("/ultimate?tab=automation&gmail=session-expired");
  }
  try {
    const configuration = await getGmailGoogleConfiguration();
    const callbackUrl = new URL(req.originalUrl, getBaseUrl(req));
    const tokens = await oidc.authorizationCodeGrant(configuration, callbackUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState,
      expectedNonce,
    });
    const claims = tokens.claims();
    const email = typeof claims?.email === "string" ? claims.email : "";
    if (!email || claims?.email_verified !== true || !tokens.refresh_token) {
      throw new Error("Google did not return a verified email and offline token.");
    }
    await saveGmailConnection({
      userId: req.user!.id,
      email,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope || GMAIL_SEND_SCOPE,
    });
    res.redirect("/ultimate?tab=automation&gmail=connected");
  } catch (error) {
    console.error("Gmail connection callback failed:", error);
    res.redirect("/ultimate?tab=automation&gmail=failed");
  }
});

router.delete("/gmail/connection", requireUltimate, async (req, res) => {
  try {
    await disconnectGmail(req.user!.id);
    res.status(204).end();
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.get("/jobs/:id/invoice-preview", requireUltimate, async (req, res) => {
  try {
    const html = await getPreparedInvoicePreviewHtml(req.params.id, req.user!.id);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(html);
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.put("/preferences", requireUltimate, async (req, res) => {
  try {
    const data = z.object({ enabled: z.boolean(), acknowledged: z.boolean().optional() }).parse(req.body);
    if (data.enabled && !data.acknowledged && !(req as any).accountUser.aiDataConsentAt) {
      return res.status(400).json({ message: "Acknowledge the AI data notice to continue." });
    }
    const user = await storage.updateUser(req.user!.id, {
      aiEnabled: data.enabled,
      ...(data.enabled && !(req as any).accountUser.aiDataConsentAt ? { aiDataConsentAt: new Date() } : {}),
    } as any);
    res.json({ enabled: user?.aiEnabled, consentedAt: user?.aiDataConsentAt });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.post("/polish", requireUltimate, requireAiConsent, async (req, res) => {
  try {
    const data = z.object({ entryIds: z.array(z.number().int().positive()).min(1).max(100) }).parse(req.body);
    const entries = await db.select().from(timeEntries).where(and(
      eq(timeEntries.userId, req.user!.id),
      inArray(timeEntries.id, data.entryIds),
    ));
    if (entries.length !== new Set(data.entryIds).size) throw new Error("One or more selected entries are unavailable.");
    const projectIds = entries.map((entry) => entry.projectId).filter((id): id is number => Boolean(id));
    const ownedProjects = projectIds.length
      ? await db.select().from(projects).where(and(eq(projects.userId, req.user!.id), inArray(projects.id, projectIds)))
      : [];
    const clientIds = ownedProjects.map((project) => project.clientId);
    const ownedClients = clientIds.length
      ? await db.select().from(clients).where(and(eq(clients.userId, req.user!.id), inArray(clients.id, clientIds)))
      : [];
    const input = entries.map((entry) => {
      const project = ownedProjects.find((item) => item.id === entry.projectId);
      const client = ownedClients.find((item) => item.id === project?.clientId);
      return { id: entry.id, description: entry.description, project: project?.name || "", client: client?.name || "" };
    });
    const ai = await runStructuredAi<{ suggestions: Array<{ entryId: number; polishedDescription: string; reason: string }> }>({
      userId: req.user!.id,
      action: "entry_polish",
      writing: true,
      instructions: "Rewrite time-entry descriptions into concise, professional client-facing language. Never invent tasks, outcomes, tools or deliverables. Preserve proper nouns and meaning. Return one suggestion per entry, even when the original is already good.",
      input,
      schemaName: "time_entry_polish",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["suggestions"],
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["entryId", "polishedDescription", "reason"],
              properties: {
                entryId: { type: "integer" },
                polishedDescription: { type: "string" },
                reason: { type: "string" },
              },
            },
          },
        },
      },
    });
    const originals = new Map(entries.map((entry) => [entry.id, entry.description]));
    const result = {
      suggestions: ai.result.suggestions
        .filter((item) => originals.has(item.entryId))
        .map((item) => ({ ...item, originalDescription: originals.get(item.entryId) })),
    };
    const artifact = await saveAiArtifact({ userId: req.user!.id, kind: "entry_polish", source: input, inputMeta: { entryIds: data.entryIds }, result });
    res.json({ artifactId: artifact.id, ...result });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.post("/artifacts/:id/apply", requireUltimate, requireAiConsent, async (req, res) => {
  try {
    const data = z.object({ entryIds: z.array(z.number().int().positive()).min(1).max(100) }).parse(req.body);
    const [artifact] = await db.select().from(aiArtifacts).where(and(
      eq(aiArtifacts.id, req.params.id),
      eq(aiArtifacts.userId, req.user!.id),
    ));
    if (!artifact || artifact.kind !== "entry_polish") throw new Error("Polish draft not found.");
    const result = JSON.parse(artifact.result) as { suggestions: Array<{ entryId: number; polishedDescription: string; originalDescription: string }> };
    const selected = new Set(data.entryIds);
    let updatedCount = 0;
    for (const suggestion of result.suggestions) {
      if (!selected.has(suggestion.entryId)) continue;
      const [updated] = await db.update(timeEntries).set({ description: suggestion.polishedDescription }).where(and(
        eq(timeEntries.id, suggestion.entryId),
        eq(timeEntries.userId, req.user!.id),
        eq(timeEntries.description, suggestion.originalDescription),
      )).returning({ id: timeEntries.id });
      if (updated) updatedCount += 1;
    }
    await db.update(aiArtifacts).set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() }).where(eq(aiArtifacts.id, artifact.id));
    res.json({ updatedCount, skippedCount: data.entryIds.length - updatedCount });
  } catch (error) {
    sendRouteError(res, error);
  }
});

const reviewSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  clientId: z.number().int().positive().optional(),
  entryIds: z.array(z.number().int().positive()).max(500).optional(),
  mode: z.enum(["work_review", "report_summary"]).default("work_review"),
}).refine((value) => value.entryIds?.length || (value.startDate && value.endDate), "Choose a date range or entries.");

router.post("/review", requireUltimate, requireAiConsent, async (req, res) => {
  try {
    const data = reviewSchema.parse(req.body);
    const conditions = [eq(timeEntries.userId, req.user!.id)];
    if (data.entryIds?.length) conditions.push(inArray(timeEntries.id, data.entryIds));
    if (data.startDate) conditions.push(gte(timeEntries.date, data.startDate));
    if (data.endDate) conditions.push(lte(timeEntries.date, data.endDate));
    const rows = await db
      .select({ entry: timeEntries, project: projects, client: clients })
      .from(timeEntries)
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(and(...conditions));
    const filtered = data.clientId ? rows.filter((row) => row.client?.id === data.clientId) : rows;
    if (!filtered.length) throw new Error("No work was found for this selection.");
    const totalHours = filtered.reduce((sum, row) => sum + Number(row.entry.duration || 0), 0);
    const input = {
      mode: data.mode,
      range: { startDate: data.startDate, endDate: data.endDate },
      totals: { entries: filtered.length, hours: Number(totalHours.toFixed(2)) },
      entries: filtered.map(({ entry, project, client }) => ({
        date: entry.date,
        description: entry.description,
        durationHours: Number(entry.duration || 0),
        project: project?.name || "Unassigned",
        client: client?.name || "Unassigned",
        billable: entry.billable !== false,
      })),
    };
    const ai = await runStructuredAi<{
      headline: string;
      summary: string;
      accomplishments: string[];
      insights: string[];
      checks: string[];
      clientReadySummary: string;
    }>({
      userId: req.user!.id,
      action: data.mode,
      writing: true,
      instructions: "Analyze only the supplied time-entry facts. Do not invent outcomes. Produce a concise work review, practical operational insights, data-quality checks, and a polished client-ready summary. Treat calculated totals as authoritative.",
      input,
      schemaName: "work_review",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "summary", "accomplishments", "insights", "checks", "clientReadySummary"],
        properties: {
          headline: { type: "string" },
          summary: { type: "string" },
          accomplishments: { type: "array", items: { type: "string" } },
          insights: { type: "array", items: { type: "string" } },
          checks: { type: "array", items: { type: "string" } },
          clientReadySummary: { type: "string" },
        },
      },
    });
    const artifact = await saveAiArtifact({ userId: req.user!.id, clientId: data.clientId, kind: data.mode, source: input, inputMeta: data, result: ai.result });
    res.json({ artifactId: artifact.id, totals: input.totals, ...ai.result });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.put("/clients/:id/preferences", requireUltimate, async (req, res) => {
  try {
    const clientId = Number(req.params.id);
    const data = z.object({
      tone: z.enum(["concise", "warm", "formal", "detailed"]),
      language: z.string().trim().min(2).max(50),
      terminology: z.string().trim().max(1000).default(""),
      instructions: z.string().trim().max(2000).default(""),
    }).parse(req.body);
    const client = await storage.getClient(clientId);
    if (!client || client.userId !== req.user!.id) throw new Error("Client not found.");
    let existing: Record<string, any> = {};
    try { existing = JSON.parse(client.aiPreferences || "{}"); } catch {}
    const preferences = { ...existing, ...data };
    const updated = await storage.updateClient(clientId, { aiPreferences: JSON.stringify(preferences) } as any);
    res.json({ clientId, preferences, client: updated });
  } catch (error) {
    sendRouteError(res, error);
  }
});

const automationProfileSchema = z.object({
  emailSubjectTemplate: z.string().trim().min(1).max(200),
  emailBodyTemplate: z.string().trim().min(1).max(5000),
  roundHoursUp: z.boolean().default(false),
  percentageIncreaseEnabled: z.boolean().default(false),
  percentageIncrease: z.number().min(0).max(500).default(0),
  replyToEmail: z.union([z.string().trim().email(), z.literal("")]),
  replyToName: z.string().trim().max(120).default(""),
  deliveryMethod: z.enum(["client", "self", "gmail"]).default("client"),
});

const invoiceCustomizationSchema = z.object({
  invoiceTemplate: z.enum(["classic", "professional", "media", "web", "graphic", "minimalistic", "freelancer", "avant", "luxe"]),
  invoiceColorTheme: z.string().regex(/^#[0-9a-f]{6}$/i),
  invoiceAccentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  invoiceTextColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  invoiceBackgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  showDateColumn: z.boolean(),
  showHourlyRate: z.boolean(),
  showProjectName: z.boolean(),
  showBankDetails: z.boolean(),
  showPaymentTerms: z.boolean(),
  showInvoiceNotes: z.boolean(),
  showFooterNotes: z.boolean(),
  invoiceNotes: z.string().max(3000),
  paymentTerms: z.string().max(3000),
  invoiceFooterText: z.string().max(3000),
  invoiceHeaderPlacement: z.enum(["standard", "reversed", "centered"]),
  invoiceInfoLayout: z.enum(["columns", "stacked"]),
  invoiceInfoOrder: z.enum([
    "payment,terms,notes",
    "payment,notes,terms",
    "terms,payment,notes",
    "terms,notes,payment",
    "notes,payment,terms",
    "notes,terms,payment",
  ]),
  invoicePaymentAccentSide: z.enum(["left", "right"]),
});

const invoiceCustomizationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "invoiceTemplate", "invoiceColorTheme", "invoiceAccentColor", "invoiceTextColor", "invoiceBackgroundColor",
    "showDateColumn", "showHourlyRate", "showProjectName", "showBankDetails", "showPaymentTerms",
    "showInvoiceNotes", "showFooterNotes", "invoiceNotes", "paymentTerms", "invoiceFooterText",
    "invoiceHeaderPlacement", "invoiceInfoLayout", "invoiceInfoOrder", "invoicePaymentAccentSide",
  ],
  properties: {
    invoiceTemplate: { type: "string", enum: ["classic", "professional", "media", "web", "graphic", "minimalistic", "freelancer", "avant", "luxe"] },
    invoiceColorTheme: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    invoiceAccentColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    invoiceTextColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    invoiceBackgroundColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    showDateColumn: { type: "boolean" },
    showHourlyRate: { type: "boolean" },
    showProjectName: { type: "boolean" },
    showBankDetails: { type: "boolean" },
    showPaymentTerms: { type: "boolean" },
    showInvoiceNotes: { type: "boolean" },
    showFooterNotes: { type: "boolean" },
    invoiceNotes: { type: "string" },
    paymentTerms: { type: "string" },
    invoiceFooterText: { type: "string" },
    invoiceHeaderPlacement: { type: "string", enum: ["standard", "reversed", "centered"] },
    invoiceInfoLayout: { type: "string", enum: ["columns", "stacked"] },
    invoiceInfoOrder: { type: "string", enum: ["payment,terms,notes", "payment,notes,terms", "terms,payment,notes", "terms,notes,payment", "notes,payment,terms", "notes,terms,payment"] },
    invoicePaymentAccentSide: { type: "string", enum: ["left", "right"] },
  },
} as const;

router.post("/invoice-customization/interpret", requireUltimate, requireAiConsent, async (req, res) => {
  try {
    const data = z.object({
      instruction: z.string().trim().min(3).max(2000),
      current: z.record(z.unknown()),
      context: z.enum(["settings", "client"]).default("settings"),
    }).parse(req.body);
    const ai = await runStructuredAi<{ customization: z.infer<typeof invoiceCustomizationSchema>; summary: string }>({
      userId: req.user!.id,
      action: "invoice_design_edit",
      writing: true,
      instructions: "Act as a careful invoice designer. Apply the user's instruction to the supplied current invoice settings. Return the complete settings object, preserving every unrelated value. Translate spatial requests into the available layout controls. Never add HTML, CSS, scripts, bank details, legal claims, financial amounts, or facts that the user did not supply. Keep invoice copy concise and professional.",
      input: data,
      schemaName: "invoice_design_edit",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["customization", "summary"],
        properties: {
          customization: invoiceCustomizationJsonSchema,
          summary: { type: "string" },
        },
      },
    });
    const customization = invoiceCustomizationSchema.parse(ai.result.customization);
    res.json({ customization, summary: ai.result.summary.trim() });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.put("/clients/:id/automation-profile", requireUltimate, async (req, res) => {
  try {
    const clientId = Number(req.params.id);
    const automation = automationProfileSchema.parse(req.body);
    const client = await storage.getClient(clientId);
    if (!client || client.userId !== req.user!.id) throw new Error("Client not found.");
    let existing: Record<string, any> = {};
    try { existing = JSON.parse(client.aiPreferences || "{}"); } catch {}
    const preferences = { ...existing, automation };
    const updated = await storage.updateClient(clientId, { aiPreferences: JSON.stringify(preferences) } as any);
    res.json({ clientId, automation, client: updated });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.post("/clients/:id/email-polish", requireUltimate, requireAiConsent, async (req, res) => {
  try {
    const clientId = Number(req.params.id);
    const data = z.object({
      subject: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(5000),
    }).parse(req.body);
    const client = await storage.getClient(clientId);
    if (!client || client.userId !== req.user!.id) throw new Error("Client not found.");
    let preferences: Record<string, any> = {};
    try { preferences = JSON.parse(client.aiPreferences || "{}"); } catch {}
    const ai = await runStructuredAi<{ subject: string; body: string }>({
      userId: req.user!.id,
      action: "invoice_email_polish",
      writing: true,
      instructions: "Polish this reusable invoice email template. Keep it concise, professional, and natural. Preserve every {placeholder} exactly as written and do not add facts, payment promises, or new placeholders.",
      input: {
        client: { name: client.name, language: client.invoiceLanguage, preferences },
        subject: data.subject,
        body: data.body,
      },
      schemaName: "invoice_email_template",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["subject", "body"],
        properties: { subject: { type: "string" }, body: { type: "string" } },
      },
    });
    res.json({ subject: ai.result.subject.trim(), body: ai.result.body.trim() });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.get("/automation", requireUltimate, async (req, res) => {
  try {
    res.json(await listAutomationData(req.user!.id));
  } catch (error) {
    sendRouteError(res, error);
  }
});

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const scheduleSchema = z.object({
  clientId: z.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  enabled: z.boolean().default(true),
  billingDay: z.number().int().min(1).max(28),
  sendHour: z.number().int().min(0).max(23),
  timezone: z.string().trim().min(1).max(80),
  periodMode: z.enum(["previous_month", "specific_month", "custom_range"]).default("previous_month"),
  periodStart: dateStringSchema.nullable().optional(),
  periodEnd: dateStringSchema.nullable().optional(),
  prepareDate: dateStringSchema.optional(),
  requireApproval: z.boolean().default(true),
  cancellationWindowMinutes: z.number().int().min(5).max(10080).default(60),
});

const isCalendarDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const validateOneTimePeriod = (data: {
  periodMode: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  prepareDate?: string;
}) => {
  if (data.periodMode === "previous_month") return;
  if (!data.periodStart || !data.periodEnd || !data.prepareDate) {
    throw new Error("Choose the invoice period and preparation date.");
  }
  if (![data.periodStart, data.periodEnd, data.prepareDate].every(isCalendarDate)) {
    throw new Error("Choose valid invoice and preparation dates.");
  }
  if (data.periodStart > data.periodEnd) throw new Error("The invoice start date must be before its end date.");
  if (data.prepareDate <= data.periodEnd) throw new Error("The preparation date must be after the invoice period ends.");
  if (data.periodMode === "specific_month") {
    const [year, month] = data.periodStart.split("-").map(Number);
    const expectedEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    if (!data.periodStart.endsWith("-01") || data.periodEnd !== expectedEnd) {
      throw new Error("Choose a complete calendar month for this invoice period.");
    }
  }
};

router.post("/schedules", requireUltimate, async (req, res) => {
  try {
    const data = scheduleSchema.parse(req.body);
    validateOneTimePeriod(data);
    const client = await storage.getClient(data.clientId);
    if (!client || client.userId !== req.user!.id) throw new Error("Client not found.");
    try { Intl.DateTimeFormat("en", { timeZone: data.timezone }); } catch { throw new Error("Choose a valid timezone."); }
    const { prepareDate, ...scheduleData } = data;
    const isRecurring = data.periodMode === "previous_month";
    const [schedule] = await db.insert(recurringInvoiceSchedules).values({
      ...scheduleData,
      userId: req.user!.id,
      frequency: isRecurring ? "monthly" : "once",
      periodStart: isRecurring ? null : data.periodStart,
      periodEnd: isRecurring ? null : data.periodEnd,
      nextRunAt: isRecurring
        ? getNextMonthlyRun(new Date(), data.billingDay, data.sendHour, data.timezone)
        : getZonedDateRunAt(prepareDate!, data.sendHour, data.timezone),
    }).returning();
    res.status(201).json(schedule);
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.put("/schedules/:id", requireUltimate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = scheduleSchema.partial().parse(req.body);
    if (data.timezone) {
      try { Intl.DateTimeFormat("en", { timeZone: data.timezone }); } catch { throw new Error("Choose a valid timezone."); }
    }
    const [existing] = await db.select().from(recurringInvoiceSchedules).where(and(eq(recurringInvoiceSchedules.id, id), eq(recurringInvoiceSchedules.userId, req.user!.id)));
    if (!existing) throw new Error("Schedule not found.");
    if (data.clientId) {
      const client = await storage.getClient(data.clientId);
      if (!client || client.userId !== req.user!.id) throw new Error("Client not found.");
    }
    const billingDay = data.billingDay ?? existing.billingDay;
    const sendHour = data.sendHour ?? existing.sendHour;
    const timezone = data.timezone || existing.timezone;
    const periodMode = data.periodMode || existing.periodMode;
    const periodStart = data.periodStart === undefined ? existing.periodStart : data.periodStart;
    const periodEnd = data.periodEnd === undefined ? existing.periodEnd : data.periodEnd;
    const schedulingChanged = ["periodMode", "periodStart", "periodEnd", "prepareDate", "billingDay", "sendHour", "timezone"]
      .some((key) => Object.prototype.hasOwnProperty.call(data, key));
    if (periodMode !== "previous_month" && schedulingChanged) {
      validateOneTimePeriod({ periodMode, periodStart, periodEnd, prepareDate: data.prepareDate });
    }
    if (existing.frequency === "once" && existing.lastRunAt && data.enabled === true) {
      throw new Error("A completed one-time schedule cannot be activated again.");
    }
    const { prepareDate, ...updates } = data;
    const isRecurring = periodMode === "previous_month";
    const [updated] = await db.update(recurringInvoiceSchedules).set({
      ...updates,
      frequency: isRecurring ? "monthly" : "once",
      periodStart: isRecurring ? null : periodStart,
      periodEnd: isRecurring ? null : periodEnd,
      nextRunAt: schedulingChanged
        ? isRecurring
          ? getNextMonthlyRun(new Date(), billingDay, sendHour, timezone)
          : getZonedDateRunAt(prepareDate!, sendHour, timezone)
        : existing.nextRunAt,
      updatedAt: new Date(),
    }).where(eq(recurringInvoiceSchedules.id, id)).returning();
    res.json(updated);
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.delete("/schedules/:id", requireUltimate, async (req, res) => {
  try {
    const [deleted] = await db.delete(recurringInvoiceSchedules).where(and(
      eq(recurringInvoiceSchedules.id, Number(req.params.id)),
      eq(recurringInvoiceSchedules.userId, req.user!.id),
    )).returning({ id: recurringInvoiceSchedules.id });
    if (!deleted) return res.status(404).json({ message: "Schedule not found." });
    res.json({ deleted: true });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.post("/schedules/:id/run", requireUltimate, async (req, res) => {
  try {
    const scheduleId = Number(req.params.id);
    const [schedule] = await db.select().from(recurringInvoiceSchedules).where(and(
      eq(recurringInvoiceSchedules.id, scheduleId),
      eq(recurringInvoiceSchedules.userId, req.user!.id),
    ));
    if (!schedule) throw new Error("Schedule not found.");
    if (schedule.frequency === "once" && schedule.lastRunAt) throw new Error("This one-time period was already prepared.");
    const job = await prepareInvoiceJob({ scheduleId, userId: req.user!.id });
    if (schedule.frequency === "once") {
      await db.update(recurringInvoiceSchedules).set({ enabled: false, lastRunAt: new Date(), updatedAt: new Date() }).where(eq(recurringInvoiceSchedules.id, schedule.id));
    }
    res.status(201).json(job);
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.post("/jobs/:id/approve", requireUltimate, async (req, res) => {
  try {
    res.json(await approveInvoiceJob(req.params.id, req.user!.id, req.body?.sendNow === true));
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.post("/jobs/:id/send-now", requireUltimate, async (req, res) => {
  try {
    const job = await approveInvoiceJob(req.params.id, req.user!.id, true);
    res.json(await sendPreparedInvoice(job.id, req.user!.id));
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.post("/jobs/:id/retry", requireUltimate, async (req, res) => {
  try {
    res.json(await sendPreparedInvoice(req.params.id, req.user!.id));
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.post("/jobs/:id/cancel", requireUltimate, async (req, res) => {
  try {
    res.json(await cancelInvoiceJob(req.params.id, req.user!.id));
  } catch (error) {
    sendRouteError(res, error);
  }
});

const preparedLineItemSchema = z.object({
  key: z.string().trim().min(1).max(250),
  description: z.string().trim().min(1).max(500),
  projectName: z.string().trim().max(200).default(""),
  hours: z.number().min(0).max(1_000_000),
  rate: z.number().min(0).max(1_000_000_000),
  weekLabel: z.string().trim().max(100).optional(),
  isCustom: z.boolean().optional(),
});

router.put("/jobs/:id/draft", requireUltimate, async (req, res) => {
  try {
    const data = z.object({
      emailSubject: z.string().trim().min(1).max(200),
      emailBody: z.string().trim().min(1).max(5000),
      lineItems: z.array(preparedLineItemSchema).max(200),
      invoiceCustomization: invoiceCustomizationSchema.partial().optional(),
    }).parse(req.body);
    res.json(await updatePreparedInvoiceJob({
      jobId: req.params.id,
      userId: req.user!.id,
      ...data,
    }));
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.post("/jobs/:id/ai-edit", requireUltimate, requireAiConsent, async (req, res) => {
  try {
    const data = z.object({ instruction: z.string().trim().min(3).max(2000) }).parse(req.body);
    const [job] = await db.select().from(invoiceAutomationJobs).where(and(
      eq(invoiceAutomationJobs.id, req.params.id),
      eq(invoiceAutomationJobs.userId, req.user!.id),
    ));
    if (!job) throw new Error("Prepared invoice not found.");
    if (!["pending_approval", "needs_attention", "scheduled"].includes(job.status)) {
      throw new Error("This prepared invoice can no longer be edited.");
    }
    const payload = JSON.parse(job.payload) as any;
    const currentCustomization = {
      invoiceTemplate: payload.business?.invoiceTemplate || "professional",
      invoiceColorTheme: payload.business?.invoiceColorTheme || "#12283d",
      invoiceAccentColor: payload.business?.invoiceAccentColor || "#2d6cdf",
      invoiceTextColor: payload.business?.invoiceTextColor || "#111827",
      invoiceBackgroundColor: payload.business?.invoiceBackgroundColor || "#ffffff",
      showDateColumn: payload.business?.showDateColumn === true,
      showHourlyRate: payload.business?.showHourlyRate !== false,
      showProjectName: payload.business?.showProjectName !== false,
      showBankDetails: payload.business?.showBankDetails !== false,
      showPaymentTerms: payload.business?.showPaymentTerms === true,
      showInvoiceNotes: payload.business?.showInvoiceNotes !== false,
      showFooterNotes: payload.business?.showFooterNotes !== false,
      invoiceNotes: payload.notes || "",
      paymentTerms: payload.paymentTerms || "",
      invoiceFooterText: payload.business?.invoiceFooterText || "",
      invoiceHeaderPlacement: payload.business?.invoiceHeaderPlacement || "standard",
      invoiceInfoLayout: payload.business?.invoiceInfoLayout || "columns",
      invoiceInfoOrder: payload.business?.invoiceInfoOrder || "payment,terms,notes",
      invoicePaymentAccentSide: payload.business?.invoicePaymentAccentSide || "left",
    };
    const ai = await runStructuredAi<{
      lineItems: Array<{ key: string; description: string; projectName: string; hours: number; rate: number; weekLabel: string; isCustom: boolean }>;
      customization: z.infer<typeof invoiceCustomizationSchema>;
      summary: string;
    }>({
      userId: req.user!.id,
      action: "prepared_invoice_edit",
      writing: true,
      instructions: "Edit the prepared invoice exactly as requested. You may rename, regroup, add, remove, or reorder line items, and change the available layout controls. Preserve unrelated content. A weekLabel is a visible grouping title; use an empty string for no group. isCustom means quantity-based rather than hourly. Never invent completed work or payment details. Preserve quantities and rates unless the user explicitly asks to change them. Do not calculate amounts; the server recalculates all totals. Never output HTML, CSS, scripts, or unsupported layout instructions.",
      input: {
        instruction: data.instruction,
        currency: payload.currency,
        client: payload.client?.name,
        lineItems: payload.lineItems,
        customization: currentCustomization,
      },
      schemaName: "prepared_invoice_edit",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["lineItems", "customization", "summary"],
        properties: {
          lineItems: {
            type: "array",
            maxItems: 200,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["key", "description", "projectName", "hours", "rate", "weekLabel", "isCustom"],
              properties: {
                key: { type: "string" },
                description: { type: "string" },
                projectName: { type: "string" },
                hours: { type: "number" },
                rate: { type: "number" },
                weekLabel: { type: "string" },
                isCustom: { type: "boolean" },
              },
            },
          },
          customization: invoiceCustomizationJsonSchema,
          summary: { type: "string" },
        },
      },
    });
    const lineItems = z.array(preparedLineItemSchema).min(1).max(200).parse(
      ai.result.lineItems.map((item) => ({ ...item, weekLabel: item.weekLabel || undefined })),
    );
    const customization = invoiceCustomizationSchema.parse(ai.result.customization);
    res.json({ lineItems, customization, summary: ai.result.summary.trim() });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.get("/jobs/:id/audit", requireUltimate, async (req, res) => {
  try {
    const events = await db.select().from(invoiceAutomationAudit).where(and(
      eq(invoiceAutomationAudit.jobId, req.params.id),
      eq(invoiceAutomationAudit.userId, req.user!.id),
    )).orderBy(desc(invoiceAutomationAudit.createdAt));
    res.json(events);
  } catch (error) {
    sendRouteError(res, error);
  }
});

export default router;
