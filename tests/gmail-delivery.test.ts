import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { buildGmailInvoiceMessage } from "../server/integrations/gmail-message";
import { decryptSecret, encryptSecret, isSecretVaultConfigured } from "../server/utils/secret-vault";

test("OAuth refresh tokens are encrypted with authenticated encryption", () => {
  const previous = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  process.env.OAUTH_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  try {
    assert.equal(isSecretVaultConfigured(), true);
    const encrypted = encryptSecret("refresh-token-secret");
    assert.notEqual(encrypted, "refresh-token-secret");
    assert.equal(encrypted.includes("refresh-token-secret"), false);
    assert.equal(decryptSecret(encrypted), "refresh-token-secret");
    assert.throws(() => decryptSecret(`${encrypted.slice(0, -1)}x`));
  } finally {
    if (previous === undefined) delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    else process.env.OAUTH_TOKEN_ENCRYPTION_KEY = previous;
  }
});

test("Gmail invoice message contains a PDF attachment and sanitized headers", () => {
  const message = buildGmailInvoiceMessage({
    fromEmail: "owner@example.com",
    senderName: "Northstar\r\nBcc: attacker@example.com",
    to: "client@example.com",
    replyTo: "owner@example.com",
    subject: "Invoice 1042",
    htmlContent: "<p>Your invoice is attached.</p>",
    invoiceNumber: "INV-1042",
    pdfBase64: Buffer.from("sample-pdf").toString("base64"),
  });

  assert.match(message, /From: =\?UTF-8\?B\?/);
  assert.match(message, /<owner@example\.com>/);
  assert.match(message, /Content-Type: application\/pdf/);
  assert.match(message, /filename="INV-1042\.pdf"/);
  assert.doesNotMatch(message, /\r\nBcc: attacker@example\.com/);
});
