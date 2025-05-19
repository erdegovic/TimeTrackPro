import SibApiV3Sdk from 'sib-api-v3-sdk';

// Initialize Brevo (previously Sendinblue) API
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];

// Set the API key from environment variables
apiKey.apiKey = process.env.BREVO_API_KEY;

/**
 * Send verification email to user upon registration
 */
export async function sendVerificationEmail(
  email: string, 
  username: string, 
  verificationToken: string
): Promise<boolean> {
  try {
    const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email/${verificationToken}`;
    
    // Create email
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = 'Verify Your Email Address';
    sendSmtpEmail.htmlContent = `
      <h1>Welcome to TimeTracker</h1>
      <p>Hello ${username},</p>
      <p>Thank you for registering. Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationUrl}">Verify Email Address</a></p>
      <p>If you did not create an account, please ignore this email.</p>
      <p>This link will expire in 24 hours.</p>
    `;
    sendSmtpEmail.sender = { name: 'TimeTracker', email: 'noreply@timetracker.com' };
    sendSmtpEmail.to = [{ email }];
    
    // Send email
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
}

/**
 * Send password reset email to user
 */
export async function sendPasswordResetEmail(
  email: string, 
  username: string, 
  resetToken: string
): Promise<boolean> {
  try {
    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    
    // Create email
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = 'Reset Your Password';
    sendSmtpEmail.htmlContent = `
      <h1>TimeTracker Password Reset</h1>
      <p>Hello ${username},</p>
      <p>You requested to reset your password. Please click the link below to reset it:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you did not request a password reset, please ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `;
    sendSmtpEmail.sender = { name: 'TimeTracker', email: 'noreply@timetracker.com' };
    sendSmtpEmail.to = [{ email }];
    
    // Send email
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}

/**
 * Validate reCAPTCHA token
 */
export async function validateCaptcha(token: string): Promise<boolean> {
  try {
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      console.warn('RECAPTCHA_SECRET_KEY not set, captcha validation bypassed');
      return true; // For development without recaptcha
    }
    
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`
    });
    
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Error validating captcha:', error);
    return false;
  }
}