import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

const getKey = () => {
  const encoded = process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim()
    || process.env.ACCOUNT_BACKUP_ENCRYPTION_KEY?.trim()
    || "";
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
};

export const isSecretVaultConfigured = () => {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
};

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string): string {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Unsupported encrypted secret");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
