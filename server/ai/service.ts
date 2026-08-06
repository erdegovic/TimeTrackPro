import crypto from "crypto";
import OpenAI from "openai";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { aiArtifacts, aiUsageEvents } from "@shared/schema";
import { estimateAiCostMicros } from "@shared/ultimate";
import { ULTIMATE_MONTHLY_AI_ACTIONS } from "@shared/subscriptions";

export class AiConfigurationError extends Error {}
export class AiQuotaError extends Error {}

type StructuredRunOptions = {
  userId: number;
  action: string;
  instructions: string;
  input: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
  writing?: boolean;
};

const getMonthStart = () => {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

export async function getAiUsage(userId: number) {
  const monthStart = getMonthStart();
  const [usage] = await db
    .select({
      actionsUsed: sql<number>`coalesce(sum(${aiUsageEvents.actionUnits}), 0)`,
      estimatedCostMicros: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostMicros}), 0)`,
    })
    .from(aiUsageEvents)
    .where(and(eq(aiUsageEvents.userId, userId), gte(aiUsageEvents.createdAt, monthStart)));

  return {
    actionsUsed: Number(usage?.actionsUsed || 0),
    actionsLimit: ULTIMATE_MONTHLY_AI_ACTIONS,
    estimatedCostMicros: Number(usage?.estimatedCostMicros || 0),
    resetsAt: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)),
  };
}

const parseJson = <T>(value: string): T => {
  const trimmed = value.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed) as T;
};

export async function runStructuredAi<T>(options: StructuredRunOptions): Promise<{
  result: T;
  model: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiConfigurationError("Tickd AI is not configured yet.");

  const usage = await getAiUsage(options.userId);
  const hardCostMicros = Number(process.env.AI_MONTHLY_COST_LIMIT_MICROS || 2_000_000);
  if (usage.actionsUsed >= usage.actionsLimit || usage.estimatedCostMicros >= hardCostMicros) {
    throw new AiQuotaError("Your monthly Smart Actions allowance has been reached.");
  }

  const model = options.writing
    ? process.env.OPENAI_AI_WRITING_MODEL || "gpt-5.4-mini"
    : process.env.OPENAI_AI_MODEL || "gpt-5.4-nano";
  const openai = new OpenAI({ apiKey });
  const response = await openai.responses.create({
    model,
    instructions: options.instructions,
    input: JSON.stringify(options.input),
    text: {
      format: {
        type: "json_schema",
        name: options.schemaName,
        strict: true,
        schema: options.schema,
      },
    },
  } as any);

  const raw = (response as any).output_text;
  if (!raw) throw new Error("The AI response was empty.");
  const inputTokens = Number((response as any).usage?.input_tokens || 0);
  const outputTokens = Number((response as any).usage?.output_tokens || 0);

  await db.insert(aiUsageEvents).values({
    userId: options.userId,
    action: options.action,
    actionUnits: 1,
    model,
    inputTokens,
    outputTokens,
    estimatedCostMicros: estimateAiCostMicros(model, inputTokens, outputTokens),
  });

  return { result: parseJson<T>(raw), model };
}

export const sourceHash = (value: unknown) => crypto
  .createHash("sha256")
  .update(JSON.stringify(value))
  .digest("hex");

export async function saveAiArtifact(params: {
  userId: number;
  clientId?: number | null;
  kind: string;
  inputMeta?: unknown;
  source: unknown;
  result: unknown;
}) {
  const id = crypto.randomUUID();
  const [artifact] = await db.insert(aiArtifacts).values({
    id,
    userId: params.userId,
    clientId: params.clientId || null,
    kind: params.kind,
    sourceHash: sourceHash(params.source),
    inputMeta: params.inputMeta ? JSON.stringify(params.inputMeta) : null,
    result: JSON.stringify(params.result),
  }).returning();
  return artifact;
}
