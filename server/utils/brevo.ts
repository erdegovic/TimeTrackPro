import * as SibApiV3Sdk from 'sib-api-v3-sdk';

// Configure the API key
let apiKeyConfigured = false;

try {
  if (process.env.BREVO_API_KEY) {
    SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
    apiKeyConfigured = true;
    console.log('Brevo API key configured successfully');
  } else {
    console.warn('BREVO_API_KEY not found in environment, email functionality will be limited');
  }
} catch (error) {
  console.error('Failed to initialize Brevo API:', error);
}

// Get sender email configuration
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@timetracker.com';
const SENDER_NAME = 'Time Tracker App';

export interface EmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

/**
 * Send an email using Brevo API
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    console.log(`Preparing to send email to ${options.to} with subject "${options.subject}"`);
    
    // Create send email object
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: options.to }];
    sendSmtpEmail.subject = options.subject;
    sendSmtpEmail.htmlContent = options.htmlContent;
    
    if (options.textContent) {
      sendSmtpEmail.textContent = options.textContent;
    }
    
    sendSmtpEmail.sender = {
      email: SENDER_EMAIL,
      name: SENDER_NAME
    };
    
    // Create a new instance for each send operation
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    
    // Actually send the email
    console.log('Sending email via Brevo API...');
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email sent successfully:', result);
    return true;
  } catch (error) {
    console.error('Failed to send email via Brevo:', error);
    
    // In development mode, provide a success log for testing purposes
    if (!process.env.BREVO_API_KEY) {
      console.log('DEV MODE - Email would have been sent to:', options.to);
      return true;
    }
    
    return false;
  }
}

/**
 * Generate HTML content for email verification
 */
export function getEmailVerificationContent(token: string, baseUrl: string, newEmail: string): string {
  const verificationUrl = `${baseUrl}/verify-email-change?token=${token}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Email Verification</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          border: 1px solid #ddd;
          border-radius: 5px;
          padding: 20px;
          margin-top: 20px;
        }
        .header {
          background-color: #f8f9fa;
          padding: 10px;
          border-radius: 5px 5px 0 0;
          border-bottom: 2px solid #eaeaea;
          margin-bottom: 20px;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          background-color: #3498db;
          color: white !important;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
          font-weight: bold;
        }
        .button:hover {
          background-color: #2980b9;
        }
        .footer {
          margin-top: 20px;
          font-size: 12px;
          color: #777;
          border-top: 1px solid #eaeaea;
          padding-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Email Verification</h2>
        </div>
        
        <p>Hello,</p>
        
        <p>You recently requested to change your email address to <strong>${newEmail}</strong>. 
        To complete this process, please click on the button below to verify your new email address:</p>
        
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </div>
        
        <p>Alternatively, you can copy and paste the following link into your browser:</p>
        <p style="word-break: break-all;"><a href="${verificationUrl}">${verificationUrl}</a></p>
        
        <p>If you did not request this change, please ignore this email or contact support.</p>
        
        <p>This verification link will expire in 24 hours.</p>
        
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}