import { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { storage } from '../storage';

// Create router
const router = Router();

// Public resend verification email endpoint (no session required)
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    console.log(`Public resend verification request for email: ${email}`);
    
    // Find user by email
    const user = await storage.getUserByEmail(email);
    
    // Don't reveal if user exists for security
    if (!user) {
      console.log(`User not found for email: ${email}`);
      return res.status(200).json({ 
        message: 'If your account exists, a verification email has been sent.' 
      });
    }
    
    // Check if user already verified
    if (user.status === 'active') {
      console.log(`User already verified: ${email}`);
      return res.status(200).json({ 
        message: 'Your account is already verified. Please log in.' 
      });
    }
    
    // Generate a new verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1); // Token expires in 24 hours
    
    // Delete any existing email verifications for this user
    const verifications = await storage.getVerificationsByUser(user.id);
    for (const verification of verifications) {
      if (verification.type === 'email') {
        await storage.deleteVerification(verification.token);
      }
    }
    
    // Create new verification record
    await storage.createVerification({
      userId: user.id,
      token,
      type: 'email',
      newEmail: '',
      expiresAt,
      createdAt: new Date()
    });
    
    // Construct the base URL for the verification link
    let baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://tickd.me' 
      : `${req.protocol}://${req.get('host')}`;
    
    // Import email utilities
    const emailModule = await import('../utils/email-service');
    
    // Generate email content with verification link
    const emailContent = emailModule.getRegistrationEmailContent(token, baseUrl);
    
    // Send verification email
    const emailSent = await emailModule.sendEmail({
      to: email,
      subject: 'Verify Your Email Address - Tickd',
      htmlContent: emailContent
    });
    
    if (emailSent) {
      console.log(`Verification email resent to ${email}`);
      
      // For development, log the verification URL
      if (process.env.NODE_ENV === 'development') {
        console.log('[DEV MODE] Email verification link:', `${baseUrl}/verify-email?token=${token}`);
      }
      
      return res.status(200).json({ 
        message: 'Verification email has been sent. Please check your inbox.' 
      });
    } else {
      console.error(`Failed to send verification email to ${email}`);
      return res.status(500).json({ 
        message: 'Failed to send verification email. Please try again later.' 
      });
    }
  } catch (error) {
    console.error('Error resending verification email:', error);
    return res.status(500).json({ 
      message: 'An unexpected error occurred. Please try again.' 
    });
  }
});

export default router;