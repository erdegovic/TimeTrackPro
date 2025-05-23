import fetch from 'node-fetch';

// Configure API key flag
let apiKeyConfigured = false;

// Check if API key is available
if (process.env.BREVO_API_KEY) {
  apiKeyConfigured = true;
  console.log('Brevo API key is available - Email service initialized');
} else {
  console.warn('BREVO_API_KEY not found in environment, email functionality will be simulated');
}

// Sender configuration
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@timetracker.com';
const SENDER_NAME = 'Time Tracker App';

export interface EmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

/**
 * Send an email using Brevo API (or simulate it in development)
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    console.log(`Preparing to send email to ${options.to} with subject "${options.subject}"`);
    
    // Extract and log the verification URL for easy testing
    const urlMatch = options.htmlContent.match(/href="([^"]+)"/);
    if (urlMatch && urlMatch[1]) {
      console.log('============== EMAIL DETAILS ==============');
      console.log('To:', options.to);
      console.log('Subject:', options.subject);
      console.log('Verification URL:', urlMatch[1]);
      console.log('==========================================');
    }
    
    // If API key is not configured, just simulate email sending
    if (!apiKeyConfigured) {
      console.log('DEV MODE - Email sending simulated (success)');
      return true;
    }
    
    // For production with API key configured
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.BREVO_API_KEY || ''
        },
        body: JSON.stringify({
          sender: { name: SENDER_NAME, email: SENDER_EMAIL },
          to: [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.htmlContent,
          textContent: options.textContent
        })
      });
      
      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`API error: ${response.status} - ${responseText}`);
      }
      
      console.log('Email sent successfully via API');
      return true;
    } catch (apiError) {
      console.error('Email API error:', apiError);
      
      // For development, we'll still consider it a success so we can test the flow
      if (process.env.NODE_ENV === 'development') {
        console.log('DEV MODE - Considering email sent despite API error');
        return true;
      }
      
      return false;
    }
  } catch (error) {
    console.error('Unexpected error in email service:', error);
    return process.env.NODE_ENV === 'development';
  }
}

/**
 * Generate HTML content for email verification
 */
export function getEmailVerificationContent(token: string, baseUrl: string, newEmail: string): string {
  // Determine if this is an email verification for registration or an email change
  const type = newEmail.includes('@') ? 'change' : 'registration';
  const path = type === 'change' ? 'verify-email-change' : 'verify-email';
  
  const verificationUrl = `${baseUrl}/${path}?token=${token}`;
  
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
          <h2>${type === 'change' ? 'Email Verification' : 'Welcome to Tickd!'}</h2>
        </div>
        
        <p>Hello,</p>
        
        ${type === 'change' 
          ? `<p>You recently requested to change your email address to <strong>${newEmail}</strong>. 
             To complete this process, please click on the button below to verify your new email address:</p>`
          : `<p>Thank you for registering with Tickd, your new time tracking solution! 
             We're excited to have you on board and look forward to helping you manage your projects more efficiently.</p>
             <p>To get started, please verify your email address by clicking the button below:</p>`
        }
        
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">${type === 'change' ? 'Verify Email Address' : 'Activate My Account'}</a>
        </div>
        
        <p>Alternatively, you can copy and paste the following link into your browser:</p>
        <p style="word-break: break-all;"><a href="${verificationUrl}">${verificationUrl}</a></p>
        
        <p>${type === 'change' 
            ? 'If you did not request this change, please ignore this email or contact support.'
            : 'If you did not create an account, please ignore this email.'
          }</p>
        
        <p>This verification link will expire in 24 hours.</p>
        
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}