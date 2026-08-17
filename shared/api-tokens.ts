import { createHash, randomBytes } from "node:crypto";

/**
 * Pure helpers for personal API tokens (`tk_` + 40 random characters).
 * Server-only (uses node:crypto); kept free of database imports so it can be unit-tested.
 */

export const API_TOKEN_PREFIX = "tk_";
export const API_TOKEN_RANDOM_LENGTH = 40;
const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateApiToken(): string {
  const bytes = randomBytes(API_TOKEN_RANDOM_LENGTH);
  let out = "";
  for (let i = 0; i < API_TOKEN_RANDOM_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${API_TOKEN_PREFIX}${out}`;
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Display prefix stored alongside the hash (never enough to reconstruct the token). */
export function apiTokenPrefix(token: string): string {
  return token.slice(0, API_TOKEN_PREFIX.length + 8);
}

export function looksLikeApiToken(value: unknown): value is string {
  return typeof value === "string" && /^tk_[A-Za-z0-9]{40}$/.test(value);
}

export function extractBearerToken(header: string | undefined | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}
