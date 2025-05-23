import type { Response } from "node-fetch";
import fetch from "node-fetch";

interface EmailParams {
  to: string;
  subject: string;
  htmlContent: string;
}

/**
 * Send email using generic API service
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    // Log email details for debugging
    console.log(`Preparing to send email to ${params.to} with subject "${params.subject}"`);
    console.log('============== EMAIL DETAILS ==============');
    console.log(`To: ${params.to}`);
    console.log(`Subject: ${params.subject}`);
    
    // Extract verification URL for easier testing
    const urlMatch = params.htmlContent.match(/href="(http[^"]+)"/);
    if (urlMatch && urlMatch[1]) {
      console.log(`Verification URL: ${urlMatch[1]}`);
    }
    console.log('==========================================');
    
    // Use API key if available, otherwise simulate success for development
    if (process.env.BREVO_API_KEY) {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "api-key": process.env.BREVO_API_KEY
        },
        body: JSON.stringify({
          sender: {
            name: "Tickd Support",
            email: process.env.SENDER_EMAIL || "support@tickd.me"
          },
          to: [{ email: params.to }],
          subject: params.subject,
          htmlContent: params.htmlContent
        })
      });
      
      if (response.ok) {
        console.log('Email sent successfully via API');
        return true;
      } else {
        const errorText = await response.text();
        console.error('Failed to send email via API:', errorText);
        return false;
      }
    } else {
      // Development mode - simulate success
      console.log('Development mode - simulating email sending success');
      return logEmailInDevelopment();
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
  
  /**
   * Log and simulate success in development environment
   */
  function logEmailInDevelopment() {
    console.log('Development mode: Email would be sent in production');
    return process.env.NODE_ENV === 'development';
  }
}

/**
 * Generate welcome email for new registrations
 */
export function getRegistrationEmailContent(token: string, baseUrl: string): string {
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to Tickd</title>
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
          <h2>Welcome to Tickd!</h2>
        </div>
        
        <p>Hello,</p>
        
        <p>Thank you for registering with Tickd, your new time tracking solution!</p>
        
        <p>We're excited to have you on board and look forward to helping you manage your projects more efficiently. With Tickd, you'll be able to track time, manage clients and projects, and generate professional invoices with just a few clicks.</p>
        
        <p>To get started, please activate your account by clicking the button below:</p>
        
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Activate My Account</a>
        </div>
        
        <p>Alternatively, you can copy and paste the following link into your browser:</p>
        <p style="word-break: break-all;"><a href="${verificationUrl}">${verificationUrl}</a></p>
        
        <p>If you did not create an account, please ignore this email.</p>
        
        <p>This verification link will expire in 24 hours.</p>
        
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate email verification content
 */
export function getEmailVerificationContent(token: string, baseUrl: string, newEmail: string): string {
  // Check if this is for registration or email change
  if (!newEmail || newEmail === '') {
    return getRegistrationEmailContent(token, baseUrl);
  }
  
  // This is for email change
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