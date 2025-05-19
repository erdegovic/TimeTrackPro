import * as SibApiV3Sdk from 'sib-api-v3-sdk';

// Initialize Brevo API instance
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const apiKey = process.env.BREVO_API_KEY;

// Configure API key authorization
const apiKeys = SibApiV3Sdk.ApiClient.instance.authentications['api-key'];
apiKeys.apiKey = apiKey;

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
  textContent = '',
  fromName = 'Time Tracker',
  fromEmail = 'noreply@timetracker.app'
}: SendEmailParams): Promise<boolean> {
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.textContent = textContent || htmlContent.replace(/<[^>]*>/g, '');
    sendSmtpEmail.sender = { 
      name: fromName, 
      email: fromEmail 
    };
    
    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email sent successfully:', response);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Send verification email to a newly registered user
 */
export async function sendVerificationEmail(
  email: string, 
  username: string, 
  token: string
): Promise<boolean> {
  const verificationUrl = `${process.env.APP_URL || 'http://localhost:5000'}/verify-email?token=${token}`;
  
  const subject = 'Verify your email address';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to Time Tracker!</h2>
      <p>Hello ${username},</p>
      <p>Thank you for registering. Please click the button below to verify your email address:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" 
           style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
          Verify Email Address
        </a>
      </p>
      <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
      <p>${verificationUrl}</p>
      <p>This verification link will expire in 24 hours.</p>
      <p>Best regards,<br>The Time Tracker Team</p>
    </div>
  `;
  
  return sendEmail({
    to: email,
    subject,
    htmlContent
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string, 
  token: string
): Promise<boolean> {
  const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${token}`;
  
  const subject = 'Reset your password';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>Hello,</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" 
           style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
          Reset Password
        </a>
      </p>
      <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
      <p>${resetUrl}</p>
      <p>This reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email.</p>
      <p>Best regards,<br>The Time Tracker Team</p>
    </div>
  `;
  
  return sendEmail({
    to: email,
    subject,
    htmlContent
  });
}