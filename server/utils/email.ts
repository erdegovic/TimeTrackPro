import * as SibApiV3Sdk from 'sib-api-v3-sdk';

// Initialize Brevo (SendinBlue) client
const apiKey = process.env.BREVO_API_KEY;
if (!apiKey) {
  console.warn('WARNING: BREVO_API_KEY environment variable is not set. Email functionality will not work.');
}

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
if (apiKey) {
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  const apiKey_auth = defaultClient.authentications['api-key'];
  apiKey_auth.apiKey = apiKey;
}

interface SendEmailParams {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  fromName?: string;
  fromEmail?: string;
}

/**
 * Send an email using Brevo API
 */
export async function sendEmail({
  to,
  subject,
  htmlContent,
  textContent,
  fromName = 'TimeTrack Pro',
  fromEmail = 'no-reply@timetrackpro.com'
}: SendEmailParams): Promise<boolean> {
  if (!apiKey) {
    console.warn('Cannot send email: BREVO_API_KEY environment variable is not set.');
    return false;
  }

  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    
    if (textContent) {
      sendSmtpEmail.textContent = textContent;
    }
    
    sendSmtpEmail.sender = {
      name: fromName,
      email: fromEmail
    };
    
    sendSmtpEmail.to = [{ email: to }];
    
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

/**
 * Send verification email to a newly registered user
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  appBaseUrl = process.env.APP_URL || 'http://localhost:5000'
): Promise<boolean> {
  const verificationLink = `${appBaseUrl}/api/auth/verify-email/${token}`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to TimeTrack Pro!</h2>
      <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Verify Email Address
        </a>
      </div>
      <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
      <p><a href="${verificationLink}">${verificationLink}</a></p>
      <p>This link will expire in 24 hours.</p>
      <p>Best regards,<br>The TimeTrack Pro Team</p>
    </div>
  `;
  
  const textContent = `
    Welcome to TimeTrack Pro!
    
    Thank you for registering. Please verify your email address by visiting the following link:
    
    ${verificationLink}
    
    This link will expire in 24 hours.
    
    Best regards,
    The TimeTrack Pro Team
  `;
  
  return sendEmail({
    to: email,
    subject: 'Verify Your Email Address',
    htmlContent,
    textContent
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  appBaseUrl = process.env.APP_URL || 'http://localhost:5000'
): Promise<boolean> {
  const resetLink = `${appBaseUrl}/reset-password/${token}`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Reset Password
        </a>
      </div>
      <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
      <p>Best regards,<br>The TimeTrack Pro Team</p>
    </div>
  `;
  
  const textContent = `
    Password Reset Request
    
    We received a request to reset your password. Please visit the following link to create a new password:
    
    ${resetLink}
    
    This link will expire in 1 hour.
    
    If you did not request a password reset, please ignore this email or contact support if you have concerns.
    
    Best regards,
    The TimeTrack Pro Team
  `;
  
  return sendEmail({
    to: email,
    subject: 'Reset Your Password',
    htmlContent,
    textContent
  });
}