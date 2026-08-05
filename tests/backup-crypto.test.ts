import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { backupChecksum, decryptBackup, encryptBackup, parseEncryptionKey } from "../server/backups/crypto";

test("backup encryption round trips without exposing plaintext", () => {
  const key = randomBytes(32).toString("base64");
  const plaintext = Buffer.from("private Tickd account data");
  const encrypted = encryptBackup(plaintext, key);

  assert.equal(encrypted.includes(plaintext), false);
  assert.deepEqual(decryptBackup(encrypted, key), plaintext);
  assert.equal(backupChecksum(encrypted).length, 64);
});

test("backup decryption rejects tampering", () => {
  const key = randomBytes(32).toString("base64");
  const encrypted = encryptBackup(Buffer.from("data"), key);
  encrypted[encrypted.length - 1] ^= 1;
  assert.throws(() => decryptBackup(encrypted, key));
});

test("backup key must contain exactly 32 bytes", () => {
  assert.throws(() => parseEncryptionKey(Buffer.from("short").toString("base64")));
});
