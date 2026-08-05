import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("TICKDB01", "ascii");
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function parseEncryptionKey(encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) {
    throw new Error("ACCOUNT_BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function encryptBackup(plaintext: Buffer, encodedKey: string): Buffer {
  const key = parseEncryptionKey(encodedKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, ciphertext]);
}

export function decryptBackup(payload: Buffer, encodedKey: string): Buffer {
  const minimumLength = MAGIC.length + IV_LENGTH + TAG_LENGTH;
  if (payload.length < minimumLength || !payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Unsupported or corrupted Tickd backup file");
  }

  const key = parseEncryptionKey(encodedKey);
  const ivStart = MAGIC.length;
  const tagStart = ivStart + IV_LENGTH;
  const ciphertextStart = tagStart + TAG_LENGTH;
  const iv = payload.subarray(ivStart, tagStart);
  const tag = payload.subarray(tagStart, ciphertextStart);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload.subarray(ciphertextStart)), decipher.final()]);
}

export function backupChecksum(payload: Buffer): string {
  return createHash("sha256").update(payload).digest("hex");
}
