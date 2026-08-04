import { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { storage } from '../storage';
import { getBaseUrl } from '../utils/url-helper';

const router = Router();

/**
 * Public endpoint to resend verification email
 * This is called from the unverified email page
 */
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const email = typeof req.body.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    console.log(`Public resend verification request for: ${email}`);
    
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

    console.log(`Generating verification token for user: ${user.id}`);

    const existingVerifications = await storage.getVerificationsByUser(user.id);
    await Promise.all(
      existingVerifications
        .filter((verification) => verification.type === 'email')
        .map((verification) => storage.deleteVerification(verification.token)),
    );
    
    // Generate a new verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration
    
    // Update user's verification token
    await storage.updateUser(user.id, {
      verificationToken: token
    });
    
    // Create verification record
    await storage.createVerification({
      userId: user.id,
      token,
      type: 'email',
      newEmail: '',
      expiresAt,
      createdAt: new Date()
    });
    
    // Get base URL for verification link
    const baseUrl = getBaseUrl(req);
    
    // Import email utilities
    const emailModule = await import('../utils/email-service');
    
    // Generate and send verification email
    const emailContent = emailModule.getRegistrationEmailContent(token, baseUrl);
    const emailSent = await emailModule.sendEmail({
      to: email,
      subject: 'Confirm your Tickd email address',
      htmlContent: emailContent
    });
    
    if (emailSent) {
      console.log(`Verification email sent to ${email}`);
      
      // Log the verification link in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV] Verification link: ${baseUrl}/verify-email?token=${token}`);
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
