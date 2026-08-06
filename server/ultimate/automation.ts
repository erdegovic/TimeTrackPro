import crypto from "crypto";
import { format } from "date-fns";
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  clients,
  invoiceAutomationAudit,
  invoiceAutomationJobs,
  projects,
  recurringInvoiceSchedules,
  timeEntries,
} from "@shared/schema";
import {
  buildAutomationLineItems,
  getNextMonthlyRun,
  getPreviousMonthPeriod,
  type AutomationLineItem,
} from "@shared/ultimate";
import { getUltimateCapabilities } from "@shared/subscriptions";
import { runStructuredAi } from "../ai/service";
import { createInvoicePdf } from "../../client/src/lib/invoice-pdf";
import type { InvoiceTemplateData } from "../../client/src/lib/invoice-html-generator";
import { sendInvoiceEmail } from "../utils/email-service";

type ValidationState = { errors: string[]; warnings: string[] };

type JobPayload = {
  client: Record<string, any>;
  business: Record<string, any>;
  lineItems: AutomationLineItem[];
  timeEntryIds: number[];
  currency: string;
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  issueDate: string;
  dueDate: string;
  notes: string;
  paymentTerms: string;
  clientPreferences: Record<string, any>;
};

const parseObject = (value?: string | null): Record<string, any> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const calculateDueDate = (issueDate: string, mode: string, days: number) => {
  const date = new Date(`${issueDate}T12:00:00`);
  if (mode === "days") date.setDate(date.getDate() + Math.max(1, days));
  else date.setMonth(date.getMonth() + 1);
  return format(date, "yyyy-MM-dd");
};

const formatPaymentDetails = (settings: Record<string, any>) => [
  settings.bankName && `Bank: ${settings.bankName}`,
  settings.bankAccountName && `Account name: ${settings.bankAccountName}`,
  settings.bankAccountNumber && `Account: ${settings.bankAccountNumber}`,
  settings.iban && `IBAN: ${settings.iban}`,
  settings.swift && `SWIFT/BIC: ${settings.swift}`,
  settings.bankSortCode && `Sort code: ${settings.bankSortCode}`,
  settings.routingNumber && `Routing number: ${settings.routingNumber}`,
  settings.paypalEmail && `PayPal: ${settings.paypalEmail}`,
  settings.wiseEmail && `Wise: ${settings.wiseEmail}`,
  settings.otherPaymentInstructions,
].filter(Boolean).join("\n");

async function addAudit(jobId: string, userId: number, action: string, details?: unknown) {
  await db.insert(invoiceAutomationAudit).values({
    jobId,
    userId,
    action,
    details: details ? JSON.stringify(details) : null,
  });
}

async function getOwnedSchedule(scheduleId: number, userId: number) {
  const [schedule] = await db.select().from(recurringInvoiceSchedules).where(and(
    eq(recurringInvoiceSchedules.id, scheduleId),
    eq(recurringInvoiceSchedules.userId, userId),
  ));
  return schedule;
}

export async function prepareInvoiceJob(params: {
  scheduleId: number;
  userId: number;
  periodStart?: string;
  periodEnd?: string;
}) {
  const schedule = await getOwnedSchedule(params.scheduleId, params.userId);
  if (!schedule) throw new Error("Schedule not found.");

  const [user, client, baseSettings] = await Promise.all([
    storage.getUser(params.userId),
    storage.getClient(schedule.clientId),
    storage.getSettings(params.userId),
  ]);
  if (!user || !getUltimateCapabilities(user.subscriptionPlan, user.subscriptionStatus).canAutomateInvoices) {
    throw new Error("Ultimate access is required.");
  }
  if (!client || client.userId !== params.userId) throw new Error("Client not found.");

  const period = params.periodStart && params.periodEnd
    ? { startDate: params.periodStart, endDate: params.periodEnd }
    : schedule.periodMode !== "previous_month" && schedule.periodStart && schedule.periodEnd
      ? { startDate: schedule.periodStart, endDate: schedule.periodEnd }
      : getPreviousMonthPeriod();
  const clientInvoiceSettings = parseObject(client.invoiceSettings);
  const effectiveSettings = clientInvoiceSettings.enabled
    ? { ...(baseSettings || {}), ...clientInvoiceSettings }
    : { ...(baseSettings || {}) };

  const rows = await db
    .select({ entry: timeEntries, project: projects })
    .from(timeEntries)
    .leftJoin(projects, eq(timeEntries.projectId, projects.id))
    .where(and(
      eq(timeEntries.userId, params.userId),
      sqlDateRange(period.startDate, period.endDate),
      isNull(timeEntries.invoiceId),
      or(eq(timeEntries.clientId, client.id), eq(projects.clientId, client.id)),
    ))
    .orderBy(asc(timeEntries.date), asc(timeEntries.id));

  const sourceEntries = rows.map(({ entry, project }) => ({
    id: entry.id,
    date: entry.date,
    description: entry.description,
    duration: entry.duration,
    projectId: entry.projectId,
    projectName: project?.name || "",
    hourlyRate: project?.hourlyRate || 0,
  }));
  let lineItems = buildAutomationLineItems(
    sourceEntries,
    effectiveSettings.enableWeeklyCategorization === true,
  );
  const validation: ValidationState = { errors: [], warnings: [] };
  if (!client.email) validation.errors.push("Add an email address to this client before sending.");
  if (!lineItems.length) validation.errors.push("No uninvoiced time entries were found for this period.");
  if (lineItems.some((item) => item.rate <= 0)) validation.errors.push("One or more projects have no hourly rate.");
  if (lineItems.some((item) => item.description === "Tracked work")) validation.warnings.push("Some entries have no client-ready description.");

  const preferences = parseObject(client.aiPreferences);
  let emailSubject = `Invoice for ${period.startDate} to ${period.endDate}`;
  let emailBody = `Hello,\n\nPlease find the attached invoice for work completed from ${period.startDate} to ${period.endDate}.\n\nThank you.`;

  if (user.aiEnabled && process.env.OPENAI_API_KEY && lineItems.length) {
    try {
      const ai = await runStructuredAi<{
        items: Array<{ key: string; description: string }>;
        emailSubject: string;
        emailBody: string;
      }>({
        userId: params.userId,
        action: "invoice_prepare",
        writing: true,
        instructions: "Polish invoice descriptions without inventing work. Preserve meaning, numbers, projects and dates. Write a concise professional invoice email in the requested client language and tone. Return only the requested JSON.",
        input: {
          client: { name: client.name, language: client.invoiceLanguage, preferences },
          period,
          lineItems: lineItems.map(({ key, description, projectName, hours }) => ({ key, description, projectName, hours })),
        },
        schemaName: "invoice_preparation",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["items", "emailSubject", "emailBody"],
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["key", "description"],
                properties: { key: { type: "string" }, description: { type: "string" } },
              },
            },
            emailSubject: { type: "string" },
            emailBody: { type: "string" },
          },
        },
      });
      const suggestions = new Map(ai.result.items.map((item) => [item.key, item.description]));
      lineItems = lineItems.map((item) => ({
        ...item,
        description: suggestions.get(item.key)?.trim() || item.description,
      }));
      emailSubject = ai.result.emailSubject.trim() || emailSubject;
      emailBody = ai.result.emailBody.trim() || emailBody;
    } catch (error) {
      validation.warnings.push("AI wording was unavailable, so Tickd kept the original descriptions.");
      console.error("Invoice AI preparation failed:", error);
    }
  }

  const issueDate = format(new Date(), "yyyy-MM-dd");
  const dueDate = calculateDueDate(
    issueDate,
    effectiveSettings.defaultDueDateMode || "calendar_month",
    Number(effectiveSettings.defaultDueDays || 30),
  );
  const subtotal = Number(lineItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
  const taxRate = effectiveSettings.enableTax ? Number(effectiveSettings.defaultTaxRate || 0) : 0;
  const tax = Number((subtotal * taxRate / 100).toFixed(2));
  const payload: JobPayload = {
    client: { ...client },
    business: effectiveSettings,
    lineItems,
    timeEntryIds: lineItems.flatMap((item) => item.timeEntryIds),
    currency: client.currency || effectiveSettings.defaultCurrency || "USD",
    subtotal,
    taxRate,
    tax,
    total: Number((subtotal + tax).toFixed(2)),
    issueDate,
    dueDate,
    notes: effectiveSettings.invoiceNotes || "",
    paymentTerms: effectiveSettings.showPaymentTerms ? effectiveSettings.paymentTerms || "" : "",
    clientPreferences: preferences,
  };
  const id = crypto.randomUUID();
  const sendAt = schedule.requireApproval
    ? null
    : new Date(Date.now() + schedule.cancellationWindowMinutes * 60_000);
  const status = validation.errors.length
    ? "needs_attention"
    : schedule.requireApproval ? "pending_approval" : "scheduled";

  const [job] = await db.insert(invoiceAutomationJobs).values({
    id,
    scheduleId: schedule.id,
    userId: params.userId,
    clientId: client.id,
    status,
    periodStart: period.startDate,
    periodEnd: period.endDate,
    payload: JSON.stringify(payload),
    validation: JSON.stringify(validation),
    emailSubject,
    emailBody,
    sendAt,
  }).returning();
  await addAudit(id, params.userId, "prepared", { status, period, validation });
  return job;
}

function sqlDateRange(startDate: string, endDate: string) {
  return and(
    lte(timeEntries.date, endDate),
    sqlGteDate(startDate),
  )!;
}

function sqlGteDate(startDate: string) {
  return sql`${timeEntries.date} >= ${startDate}`;
}

const getOwnedJob = async (jobId: string, userId: number) => {
  const [job] = await db.select().from(invoiceAutomationJobs).where(and(
    eq(invoiceAutomationJobs.id, jobId),
    eq(invoiceAutomationJobs.userId, userId),
  ));
  return job;
};

export async function approveInvoiceJob(jobId: string, userId: number, sendNow = false) {
  const job = await getOwnedJob(jobId, userId);
  if (!job) throw new Error("Prepared invoice not found.");
  if (job.status !== "pending_approval") throw new Error("This invoice is not awaiting approval.");
  const validation = JSON.parse(job.validation) as ValidationState;
  if (validation.errors.length) throw new Error(validation.errors[0]);
  const [schedule] = job.scheduleId
    ? await db.select().from(recurringInvoiceSchedules).where(eq(recurringInvoiceSchedules.id, job.scheduleId))
    : [];
  const sendAt = sendNow
    ? new Date()
    : new Date(Date.now() + Number(schedule?.cancellationWindowMinutes || 60) * 60_000);
  const [updated] = await db.update(invoiceAutomationJobs).set({
    status: "scheduled",
    sendAt,
    updatedAt: new Date(),
  }).where(eq(invoiceAutomationJobs.id, job.id)).returning();
  await addAudit(job.id, userId, "approved", { sendAt, sendNow });
  return updated;
}

export async function cancelInvoiceJob(jobId: string, userId: number) {
  const job = await getOwnedJob(jobId, userId);
  if (!job) throw new Error("Prepared invoice not found.");
  if (!["pending_approval", "scheduled", "needs_attention"].includes(job.status)) {
    throw new Error("This job can no longer be cancelled.");
  }
  const [updated] = await db.update(invoiceAutomationJobs).set({
    status: "cancelled",
    cancelledAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(invoiceAutomationJobs.id, job.id)).returning();
  await addAudit(job.id, userId, "cancelled");
  return updated;
}

function toInvoicePdfData(payload: JobPayload, invoiceNumber: string): InvoiceTemplateData {
  const business = payload.business;
  return {
    template: business.invoiceTemplate || "professional",
    language: payload.client.invoiceLanguage || business.invoiceLanguage || "en",
    businessName: business.businessName || "Your Business",
    businessMeta: business.businessTaxId ? `Tax ID: ${business.businessTaxId}` : "",
    businessAddress: [business.businessAddress, business.businessCity, business.businessCountry].filter(Boolean).join(", "),
    businessEmail: business.businessEmail || "",
    businessPhone: business.businessPhone || "",
    invoiceNumber,
    issueDate: payload.issueDate,
    dueDate: payload.dueDate,
    clientName: payload.client.name,
    clientAddress: payload.client.address || "",
    clientCity: payload.client.city || "",
    clientState: payload.client.state || "",
    clientZip: payload.client.zipCode || "",
    clientEmail: payload.client.email || "",
    lineItems: payload.lineItems.flatMap((item, index, all) => {
      const rows: InvoiceTemplateData["lineItems"] = [];
      if (item.weekLabel && (index === 0 || all[index - 1].weekLabel !== item.weekLabel)) {
        const weekTotal = all.filter((candidate) => candidate.weekLabel === item.weekLabel).reduce((sum, candidate) => sum + candidate.amount, 0);
        rows.push({ description: item.weekLabel, subDescription: "", qty: "", rate: "", amount: `${payload.currency} ${weekTotal.toFixed(2)}`, isGroupHeader: true });
      }
      rows.push({
        description: item.description,
        subDescription: item.projectName,
        qty: `${item.hours.toFixed(2)} h`,
        rate: `${payload.currency} ${item.rate.toFixed(2)}`,
        amount: `${payload.currency} ${item.amount.toFixed(2)}`,
        date: item.dates.length === 1 ? item.dates[0] : `${item.dates[0]} - ${item.dates[item.dates.length - 1]}`,
      });
      return rows;
    }),
    subtotalFormatted: payload.subtotal.toFixed(2),
    taxFormatted: payload.tax.toFixed(2),
    taxLabel: "Tax",
    totalFormatted: payload.total.toFixed(2),
    notes: payload.notes,
    showNotes: business.showInvoiceNotes !== false,
    currency: payload.currency,
    primaryColor: business.invoiceColorTheme,
    accentColor: business.invoiceAccentColor,
    textColor: business.invoiceTextColor,
    bgColor: business.invoiceBackgroundColor,
    showDateColumn: business.showDateColumn === true,
    showHourlyRate: business.showHourlyRate !== false,
    showProjectName: business.showProjectName !== false,
    paymentDetails: formatPaymentDetails(business),
    showPaymentDetails: business.showBankDetails !== false,
    paymentTerms: payload.paymentTerms,
    showPaymentTerms: business.showPaymentTerms === true,
    footerNotes: business.invoiceFooterText || "",
    showFooterNotes: business.showFooterNotes !== false,
  };
}

export async function sendPreparedInvoice(jobId: string, userId?: number) {
  const ownership = userId
    ? and(eq(invoiceAutomationJobs.id, jobId), eq(invoiceAutomationJobs.userId, userId))
    : eq(invoiceAutomationJobs.id, jobId);
  const [job] = await db.select().from(invoiceAutomationJobs).where(
    ownership,
  );
  if (!job) throw new Error("Prepared invoice not found.");
  if (job.status !== "scheduled" && job.status !== "failed") throw new Error("This invoice is not ready to send.");

  const [claimed] = await db.update(invoiceAutomationJobs).set({
    status: "sending",
    errorMessage: null,
    updatedAt: new Date(),
  }).where(and(
    ownership,
    inArray(invoiceAutomationJobs.status, ["scheduled", "failed"]),
  )).returning();
  if (!claimed) throw new Error("This invoice is already being sent.");

  const payload = JSON.parse(claimed.payload) as JobPayload;
  let invoice = claimed.invoiceId ? await storage.getInvoice(claimed.invoiceId) : undefined;
  try {
    if (!invoice) {
      const invoiceNumber = await storage.getNextInvoiceNumber(job.userId, {
        prefix: payload.business.invoiceNumberPrefix || "INV-",
        suffix: payload.business.invoiceNumberSuffix || "",
        padding: Number(payload.business.invoiceNumberPadding || 4),
      });
      invoice = await storage.createInvoice({
        invoiceNumber,
        clientId: job.clientId,
        issueDate: payload.issueDate,
        dueDate: payload.dueDate,
        status: "draft",
        subtotal: payload.subtotal.toFixed(2),
        tax: payload.tax.toFixed(2),
        taxRate: payload.taxRate.toFixed(2),
        total: payload.total.toFixed(2),
        notes: payload.notes,
        lineItems: JSON.stringify(payload.lineItems),
        userId: claimed.userId,
      });
      await db.update(invoiceAutomationJobs).set({ invoiceId: invoice.id }).where(eq(invoiceAutomationJobs.id, claimed.id));
      if (payload.timeEntryIds.length) {
        await db.update(timeEntries).set({ invoiceId: invoice.id }).where(and(
          eq(timeEntries.userId, claimed.userId),
          inArray(timeEntries.id, payload.timeEntryIds),
          isNull(timeEntries.invoiceId),
        ));
      }
    }

    const pdf = createInvoicePdf(toInvoicePdfData(payload, invoice.invoiceNumber));
    const pdfBase64 = Buffer.from(pdf.output("arraybuffer")).toString("base64");
    const sent = await sendInvoiceEmail({
      to: payload.client.email,
      replyTo: payload.business.businessEmail || undefined,
      subject: claimed.emailSubject || `Invoice ${invoice.invoiceNumber}`,
      introduction: claimed.emailBody || "Please find your invoice attached.",
      invoiceNumber: invoice.invoiceNumber,
      clientName: payload.client.name,
      total: `${payload.currency} ${payload.total.toFixed(2)}`,
      dueDate: payload.dueDate,
      pdfBase64,
    });
    if (!sent) throw new Error("The email provider did not accept this invoice.");

    await storage.updateInvoice(invoice.id, { status: "sent" });
    const [updated] = await db.update(invoiceAutomationJobs).set({
      status: "sent",
      sentAt: new Date(),
      errorMessage: null,
      updatedAt: new Date(),
    }).where(eq(invoiceAutomationJobs.id, claimed.id)).returning();
    await addAudit(claimed.id, claimed.userId, "sent", { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber });
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invoice sending failed.";
    await db.update(invoiceAutomationJobs).set({ status: "failed", errorMessage: message, updatedAt: new Date() }).where(eq(invoiceAutomationJobs.id, claimed.id));
    await addAudit(claimed.id, claimed.userId, "failed", { message });
    throw error;
  }
}

export async function runUltimateAutomationCycle() {
  const now = new Date();
  const dueSchedules = await db.select().from(recurringInvoiceSchedules).where(and(
    eq(recurringInvoiceSchedules.enabled, true),
    lte(recurringInvoiceSchedules.nextRunAt, now),
  ));

  for (const schedule of dueSchedules) {
    const isOneTime = schedule.frequency === "once";
    const nextRunAt = isOneTime
      ? schedule.nextRunAt
      : getNextMonthlyRun(now, schedule.billingDay, schedule.sendHour, schedule.timezone);
    const [claimed] = await db.update(recurringInvoiceSchedules).set({
      enabled: isOneTime ? false : schedule.enabled,
      lastRunAt: now,
      nextRunAt,
      updatedAt: now,
    }).where(and(
      eq(recurringInvoiceSchedules.id, schedule.id),
      eq(recurringInvoiceSchedules.enabled, true),
      lte(recurringInvoiceSchedules.nextRunAt, now),
    )).returning({ id: recurringInvoiceSchedules.id });
    if (!claimed) continue;
    try {
      await prepareInvoiceJob({ scheduleId: schedule.id, userId: schedule.userId });
    } catch (error) {
      console.error(`Recurring invoice schedule ${schedule.id} failed:`, error);
      if (isOneTime) {
        await db.update(recurringInvoiceSchedules).set({
          enabled: true,
          lastRunAt: null,
          nextRunAt: new Date(now.getTime() + 15 * 60 * 1000),
          updatedAt: new Date(),
        }).where(and(
          eq(recurringInvoiceSchedules.id, schedule.id),
          eq(recurringInvoiceSchedules.lastRunAt, now),
        ));
      }
    }
  }

  const jobs = await db.select().from(invoiceAutomationJobs).where(and(
    eq(invoiceAutomationJobs.status, "scheduled"),
    lte(invoiceAutomationJobs.sendAt, now),
  ));
  for (const job of jobs) {
    try {
      await sendPreparedInvoice(job.id);
    } catch (error) {
      console.error(`Prepared invoice ${job.id} failed:`, error);
    }
  }
}

export const listAutomationData = async (userId: number) => {
  const [schedules, jobs] = await Promise.all([
    db.select().from(recurringInvoiceSchedules).where(eq(recurringInvoiceSchedules.userId, userId)).orderBy(asc(recurringInvoiceSchedules.nextRunAt)),
    db.select().from(invoiceAutomationJobs).where(eq(invoiceAutomationJobs.userId, userId)).orderBy(desc(invoiceAutomationJobs.createdAt)).limit(50),
  ]);
  return {
    schedules,
    jobs: jobs.map((job) => ({
      ...job,
      payload: JSON.parse(job.payload),
      validation: JSON.parse(job.validation),
    })),
  };
};

export async function startUltimateScheduler() {
  if (process.env.NODE_ENV === "test") return;
  setTimeout(() => void runUltimateAutomationCycle(), 15_000);
  const interval = setInterval(() => void runUltimateAutomationCycle(), 60_000);
  interval.unref();
}
