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

    // Tamper with the FIRST character of the ciphertext segment rather than the
    // last character of the whole string. base64url is unpadded here, so the
    // final character of a 20-byte payload carries two significant bits and four
    // ignored ones: replacing it with "x" left the decoded bytes completely
    // unchanged whenever the original character was w, x, y or z, and GCM was
    // right to raise nothing. That made this assertion fail about one run in
    // sixteen — a flaky failure on the test that proves tampering is detected.
    const [version, iv, tag, ciphertext] = encrypted.split(".");
    const tamperedCiphertext = (ciphertext[0] === "A" ? "B" : "A") + ciphertext.slice(1);
    assert.throws(() => decryptSecret([version, iv, tag, tamperedCiphertext].join(".")));

    // A tampered authentication tag must be rejected as well.
    const tamperedTag = (tag[0] === "A" ? "B" : "A") + tag.slice(1);
    assert.throws(() => decryptSecret([version, iv, tamperedTag, ciphertext].join(".")));
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
