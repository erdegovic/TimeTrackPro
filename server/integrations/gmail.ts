import fetch from "node-fetch";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { gmailConnections } from "@shared/schema";
import { decryptSecret, encryptSecret, isSecretVaultConfigured } from "../utils/secret-vault";
import { buildGmailInvoiceMessage } from "./gmail-message";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export const isGmailIntegrationConfigured = () => Boolean(
  process.env.GOOGLE_CLIENT_ID
  && process.env.GOOGLE_CLIENT_SECRET
  && isSecretVaultConfigured()
);

export async function getGmailConnection(userId: number) {
  const [connection] = await db.select({
    userId: gmailConnections.userId,
    email: gmailConnections.email,
    scope: gmailConnections.scope,
    encryptedRefreshToken: gmailConnections.encryptedRefreshToken,
  }).from(gmailConnections).where(eq(gmailConnections.userId, userId));
  return connection;
}

export async function saveGmailConnection(params: {
  userId: number;
  email: string;
  refreshToken: string;
  scope: string;
}) {
  const values = {
    userId: params.userId,
    email: params.email.trim().toLowerCase(),
    encryptedRefreshToken: encryptSecret(params.refreshToken),
    scope: params.scope,
    updatedAt: new Date(),
  };
  const [connection] = await db.insert(gmailConnections).values(values)
    .onConflictDoUpdate({ target: gmailConnections.userId, set: values })
    .returning({ userId: gmailConnections.userId, email: gmailConnections.email, scope: gmailConnections.scope });
  return connection;
}

export async function disconnectGmail(userId: number) {
  await db.delete(gmailConnections).where(eq(gmailConnections.userId, userId));
}

async function getAccessToken(encryptedRefreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: decryptSecret(encryptedRefreshToken),
      grant_type: "refresh_token",
    }).toString(),
  });
  const result = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(result.error === "invalid_grant" ? "Reconnect Gmail before sending." : "Gmail authorization could not be refreshed.");
  }
  return result.access_token;
}

export async function sendInvoiceViaGmail(params: {
  userId: number;
  to: string;
  replyTo?: string;
  senderName: string;
  subject: string;
  htmlContent: string;
  invoiceNumber: string;
  pdfBase64: string;
}) {
  const connection = await getGmailConnection(params.userId);
  if (!connection) throw new Error("Connect Gmail before sending this invoice.");
  const accessToken = await getAccessToken(connection.encryptedRefreshToken);
  const raw = buildGmailInvoiceMessage({
    ...params,
    fromEmail: connection.email,
  });
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: Buffer.from(raw, "utf8").toString("base64url") }),
  });
  if (!response.ok) {
    const details = await response.text();
    console.error(`Gmail rejected invoice delivery (${response.status}):`, details);
    throw new Error(response.status === 401 || response.status === 403
      ? "Reconnect Gmail before sending."
      : "Gmail did not accept this invoice.");
  }
  return true;
}
