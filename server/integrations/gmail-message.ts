import { randomUUID } from "node:crypto";

const cleanHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
const encodedHeader = (value: string) => `=?UTF-8?B?${Buffer.from(cleanHeader(value), "utf8").toString("base64")}?=`;
const wrapBase64 = (value: string) => value.match(/.{1,76}/g)?.join("\r\n") || "";

export function buildGmailInvoiceMessage(params: {
  fromEmail: string;
  senderName: string;
  to: string;
  replyTo?: string;
  subject: string;
  htmlContent: string;
  invoiceNumber: string;
  pdfBase64: string;
}) {
  const boundary = `tickd-${randomUUID()}`;
  const headers = [
    `From: ${encodedHeader(params.senderName)} <${cleanHeader(params.fromEmail)}>`,
    `To: ${cleanHeader(params.to)}`,
    params.replyTo ? `Reply-To: ${cleanHeader(params.replyTo)}` : "",
    `Subject: ${encodedHeader(params.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean).join("\r\n");
  const safeFilename = cleanHeader(params.invoiceNumber).replace(/[^a-zA-Z0-9._-]+/g, "-") || "invoice";

  return [
    headers,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(params.htmlContent, "utf8").toString("base64")),
    `--${boundary}`,
    `Content-Type: application/pdf; name="${safeFilename}.pdf"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${safeFilename}.pdf"`,
    "",
    wrapBase64(params.pdfBase64),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
