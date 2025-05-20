// Use dynamic import for ESM compatibility
import fetch from 'node-fetch';

// Get API key from environment variable
const BREVO_API_KEY = process.env.BREVO_API_KEY;

// Default sender details
const DEFAULT_SENDER = {
  name: 'Time Tracker Support',
  email: 'support@timetracker.com'
};

if (BREVO_API_KEY) {
  console.log('Brevo email configuration detected');
} else {
  console.warn('BREVO_API_KEY not set. Email functionality will be limited to development mode only.');
}

interface EmailParams {
  to: string | string[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  sender?: {
    name: string;
    email: string;
  };
}

/**
 * Sends an email using Brevo API
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    if (!BREVO_API_KEY) {
      console.log('Email would be sent (DEV MODE):', params);
      console.log('IMPORTANT: For production, set BREVO_API_KEY to enable actual email delivery.');
      console.log('In demo mode, use the verification link printed in the console logs.');
      return true; // Return success in dev mode
    }

    // Format recipient for Brevo API
    const recipients = Array.isArray(params.to) 
      ? params.to.map(email => ({ email })) 
      : [{ email: params.to }];

    // Prepare email payload for Brevo
    const payload = {
      sender: params.sender || DEFAULT_SENDER,
      to: recipients,
      subject: params.subject,
      htmlContent: params.htmlContent,
      textContent: params.textContent || ''
    };

    // Send request to Brevo API
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Brevo API error: ${JSON.stringify(errorData)}`);
    }

    console.log('Email sent successfully via Brevo');
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Sends a verification email to a new user
 */
export async function sendVerificationEmail(email: string, username: string, token: string): Promise<boolean> {
  // Create a verification URL with the token
  const baseUrl = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000"}`;
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  
  console.log(`Sending verification email to ${email} with URL: ${verificationUrl}`);
  
  // Make the verification URL more prominent in logs for testing
  if (!BREVO_API_KEY) {
    console.log('==========================================================');
    console.log('DEMO MODE: Use this verification link to test the process:');
    console.log(verificationUrl);
    console.log('==========================================================');
  }
  
  const subject = 'Verify your Time Tracker account';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to Time Tracker</h2>
      <p>Hello ${username},</p>
      <p>Thank you for registering. Please click the button below to verify your email address:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Verify Email Address
        </a>
      </div>
      <p>If the button doesn't work, you can copy and paste the following link into your browser:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      <p>This verification link will expire in 24 hours.</p>
      <p>If you did not create an account, no further action is required.</p>
      <p>Best regards,</p>
      <p>Time Tracker Team</p>
    </div>
  `;
  
  const textContent = `
    Welcome to Time Tracker
    
    Hello ${username},
    
    Thank you for registering. Please click on the link below to verify your email address:
    
    ${verificationUrl}
    
    This verification link will expire in 24 hours.
    
    If you did not create an account, no further action is required.
    
    Best regards,
    Time Tracker Team
  `;
  
  return sendEmail({
    to: email,
    subject,
    htmlContent,
    textContent
  });
}

/**
 * Sends a password reset email to a user
 */
export async function sendPasswordResetEmail(email: string, username: string, token: string): Promise<boolean> {
  // Create a reset URL with the token
  const baseUrl = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000"}`;
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  
  console.log(`Sending password reset email to ${email} with URL: ${resetUrl}`);
  
  const subject = 'Reset your Time Tracker password';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>Hello ${username},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #2196F3; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Reset Password
        </a>
      </div>
      <p>If the button doesn't work, you can copy and paste the following link into your browser:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This password reset link will expire in 1 hour.</p>
      <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
      <p>Best regards,</p>
      <p>Time Tracker Team</p>
    </div>
  `;
  
  const textContent = `
    Password Reset Request
    
    Hello ${username},
    
    We received a request to reset your password. Please click on the link below to create a new password:
    
    ${resetUrl}
    
    This password reset link will expire in 1 hour.
    
    If you did not request a password reset, please ignore this email or contact support if you have concerns.
    
    Best regards,
    Time Tracker Team
  `;
  
  return sendEmail({
    to: email,
    subject,
    htmlContent,
    textContent
  });
}