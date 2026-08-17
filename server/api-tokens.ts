import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { apiTokens, type ApiToken } from "@shared/schema";
import { apiTokenPrefix, generateApiToken, hashApiToken, looksLikeApiToken } from "@shared/api-tokens";

/**
 * Personal API tokens (`Authorization: Bearer tk_…`) for external agents.
 * Only the sha256 hash is persisted; the plaintext is returned once on creation.
 * Pure helpers live in shared/api-tokens.ts.
 */
export { API_TOKEN_PREFIX, extractBearerToken, generateApiToken, hashApiToken, looksLikeApiToken } from "@shared/api-tokens";

/** What the UI is allowed to see (never the hash). */
export type PublicApiToken = {
  id: number;
  name: string;
  prefix: string;
  scopes: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date | null;
};

export const toPublicApiToken = (row: ApiToken): PublicApiToken => ({
  id: row.id,
  name: row.name,
  prefix: row.prefix,
  scopes: row.scopes,
  lastUsedAt: row.lastUsedAt,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt,
  createdAt: row.createdAt,
});

export async function listApiTokens(userId: number): Promise<PublicApiToken[]> {
  const rows = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .orderBy(desc(apiTokens.createdAt), desc(apiTokens.id));
  return rows.map(toPublicApiToken);
}

export async function createApiToken(
  userId: number,
  name: string,
  options: { expiresAt?: Date | null; scopes?: string } = {},
): Promise<{ token: string; record: PublicApiToken }> {
  const token = generateApiToken();
  const [row] = await db
    .insert(apiTokens)
    .values({
      userId,
      name,
      tokenHash: hashApiToken(token),
      prefix: apiTokenPrefix(token),
      scopes: options.scopes ?? "*",
      expiresAt: options.expiresAt ?? null,
    })
    .returning();
  return { token, record: toPublicApiToken(row) };
}

export async function revokeApiToken(userId: number, id: number): Promise<boolean> {
  const rows = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id });
  return rows.length > 0;
}

/** Resolve a plaintext token to its owner. Returns null when unknown / revoked / expired. */
export async function resolveApiToken(token: string): Promise<{ tokenId: number; userId: number } | null> {
  if (!looksLikeApiToken(token)) return null;
  const [row] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId, revokedAt: apiTokens.revokedAt, expiresAt: apiTokens.expiresAt })
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hashApiToken(token)))
    .limit(1);
  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
  return { tokenId: row.id, userId: row.userId };
}

// lastUsedAt is written at most once per token per 5 minutes so a polling agent
// does not turn every request into an UPDATE.
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;
const lastUsedWrites = new Map<number, number>();

export function touchApiToken(tokenId: number, now = Date.now()): void {
  const previous = lastUsedWrites.get(tokenId) ?? 0;
  if (now - previous < LAST_USED_THROTTLE_MS) return;
  lastUsedWrites.set(tokenId, now);
  void db
    .update(apiTokens)
    .set({ lastUsedAt: new Date(now) })
    .where(eq(apiTokens.id, tokenId))
    .catch((error) => console.error("[api-tokens] failed to record last use", error));
}
