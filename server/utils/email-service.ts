import fetch from "node-fetch";

interface EmailParams {
  to: string;
  subject: string;
  htmlContent: string;
  replyTo?: string;
}

interface TickdEmailLayoutParams {
  preheader: string;
  title: string;
  introduction: string;
  details?: string;
  actionLabel: string;
  actionUrl: string;
  expiry: string;
  securityNote: string;
}

const senderEmail = () => process.env.SENDER_EMAIL || "noreply@tickd.me";

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const createActionUrl = (baseUrl: string, path: string, token: string) => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return `${normalizedBaseUrl}${path}?token=${encodeURIComponent(token)}`;
};

const renderTickdEmail = ({
  preheader,
  title,
  introduction,
  details,
  actionLabel,
  actionUrl,
  expiry,
  securityNote,
}: TickdEmailLayoutParams) => {
  const safeActionUrl = escapeHtml(actionUrl);
  const logoUrl = escapeHtml(new URL("/tickd-logo-email.png", actionUrl).toString());

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f7fb;color:#101828;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f4f7fb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td style="padding:0 4px 18px;">
                <a href="https://tickd.me" style="display:inline-block;text-decoration:none;">
                  <img src="${logoUrl}" width="150" alt="Tickd" style="display:block;width:150px;max-width:100%;height:auto;border:0;outline:none;">
                </a>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;border:1px solid #dfe6f0;border-radius:8px;padding:40px 40px 36px;">
                <div style="width:44px;height:4px;background-color:#2474f5;border-radius:2px;margin-bottom:24px;"></div>
                <h1 style="margin:0 0 16px;color:#071127;font-size:28px;line-height:36px;font-weight:700;letter-spacing:0;">${escapeHtml(title)}</h1>
                <p style="margin:0 0 16px;color:#344054;font-size:16px;line-height:26px;">${escapeHtml(introduction)}</p>
                ${details ? `<p style="margin:0 0 16px;color:#344054;font-size:16px;line-height:26px;">${details}</p>` : ""}
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 24px;">
                  <tr>
                    <td bgcolor="#2474f5" style="border-radius:6px;">
                      <a href="${safeActionUrl}" style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-size:15px;line-height:20px;font-weight:700;">${escapeHtml(actionLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#667085;font-size:13px;line-height:21px;">${escapeHtml(expiry)}</p>
                <p style="margin:0;color:#667085;font-size:13px;line-height:21px;">${escapeHtml(securityNote)}</p>
                <div style="height:1px;background-color:#e4e9f1;margin:28px 0 20px;"></div>
                <p style="margin:0 0 7px;color:#667085;font-size:12px;line-height:19px;">If the button does not work, paste this link into your browser:</p>
                <p style="margin:0;word-break:break-all;font-size:12px;line-height:19px;"><a href="${safeActionUrl}" style="color:#1769e0;text-decoration:underline;">${safeActionUrl}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 4px 0;color:#667085;font-size:12px;line-height:19px;">
                <p style="margin:0 0 4px;">Tickd &middot; Time tracking, reports, and invoices</p>
                <p style="margin:0;">This automated message was sent by ${escapeHtml(senderEmail())}. Please do not reply.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (process.env.NODE_ENV === "development") {
    const urlMatch = params.htmlContent.match(/href="(http[^"]+)"/);
    if (urlMatch?.[1]) {
      console.log(`Development email link: ${urlMatch[1]}`);
    }
  }

  if (!process.env.BREVO_API_KEY) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Development mode: simulated transactional email "${params.subject}"`);
      return true;
    }

    console.error("Transactional email is not configured");
    return false;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: "Tickd",
          email: senderEmail(),
        },
        to: [{ email: params.to }],
        subject: params.subject,
        htmlContent: params.htmlContent,
        ...(params.replyTo ? { replyTo: { email: params.replyTo } } : {}),
      }),
    });

    if (response.ok) {
      console.log(`Transactional email accepted by Brevo: ${params.subject}`);
      return true;
    }

    const errorText = await response.text();
    console.error(`Brevo rejected transactional email (${response.status}):`, errorText);
    return false;
  } catch (error) {
    console.error("Transactional email request failed:", error);
    return false;
  }
}

export async function sendContactMessage(params: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<boolean> {
  const recipient = process.env.CONTACT_EMAIL || senderEmail();
  const safeMessage = escapeHtml(params.message).replace(/\n/g, "<br>");

  return sendEmail({
    to: recipient,
    replyTo: params.email,
    subject: `Tickd contact: ${params.subject}`,
    htmlContent: `<!doctype html>
<html lang="en"><body style="margin:0;padding:32px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#101828;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #dfe6f0;border-radius:8px;">
      <tr><td style="padding:36px;">
        <div style="width:44px;height:4px;background:#2474f5;border-radius:2px;margin-bottom:22px;"></div>
        <h1 style="margin:0 0 20px;font-size:24px;line-height:32px;">New Tickd contact message</h1>
        <p style="margin:0 0 8px;"><strong>From:</strong> ${escapeHtml(params.name)} &lt;${escapeHtml(params.email)}&gt;</p>
        <p style="margin:0 0 24px;"><strong>Subject:</strong> ${escapeHtml(params.subject)}</p>
        <div style="padding:20px;background:#f8fafc;border:1px solid #e4e9f1;border-radius:6px;font-size:15px;line-height:24px;">${safeMessage}</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
  });
}

export function getPasswordResetEmailContent(token: string, baseUrl: string): string {
  return renderTickdEmail({
    preheader: "Reset your Tickd password securely.",
    title: "Reset your password",
    introduction: "We received a request to reset the password for your Tickd account.",
    actionLabel: "Reset password",
    actionUrl: createActionUrl(baseUrl, "/reset-password", token),
    expiry: "This secure link expires in one hour and can be used only once.",
    securityNote: "If you did not request this reset, you can safely ignore this email. Your password will not change.",
  });
}

export function getRegistrationEmailContent(token: string, baseUrl: string): string {
  return renderTickdEmail({
    preheader: "Confirm your email address to finish setting up Tickd.",
    title: "Welcome to Tickd",
    introduction: "Your account is ready. Confirm your email address to start tracking time, organizing client work, and creating reports and invoices.",
    actionLabel: "Confirm email address",
    actionUrl: createActionUrl(baseUrl, "/verify-email", token),
    expiry: "This confirmation link expires in 24 hours and can be used only once.",
    securityNote: "If you did not create a Tickd account, you can safely ignore this email.",
  });
}

export function getEmailVerificationContent(token: string, baseUrl: string, newEmail: string): string {
  if (!newEmail) {
    return getRegistrationEmailContent(token, baseUrl);
  }

  return renderTickdEmail({
    preheader: "Confirm your new email address for Tickd.",
    title: "Confirm your new email",
    introduction: "A request was made to use a new email address for your Tickd account.",
    details: `Confirm that <strong style="color:#071127;">${escapeHtml(newEmail)}</strong> belongs to you by using the button below.`,
    actionLabel: "Confirm new email",
    actionUrl: createActionUrl(baseUrl, "/verify-email-change", token),
    expiry: "This confirmation link expires in 24 hours and can be used only once.",
    securityNote: "If you did not request this change, leave this email unconfirmed and keep using your current Tickd email address.",
  });
}
