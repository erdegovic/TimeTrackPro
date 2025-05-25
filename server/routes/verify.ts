import { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { storage } from '../storage';

const router = Router();

/**
 * Public endpoint to resend verification emails
 * This can be accessed without authentication
 */
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    console.log(`[VERIFY] Resend verification request for: ${email}`);
    
    // Find user by email
    const user = await storage.getUserByEmail(email);
    
    // Don't reveal if user exists for security
    if (!user) {
      console.log(`[VERIFY] User not found for email: ${email}`);
      return res.status(200).json({ 
        message: 'If your account exists, a verification email has been sent.' 
      });
    }
    
    // Check if user already verified
    if (user.status === 'active') {
      console.log(`[VERIFY] User already verified: ${email}`);
      return res.status(200).json({ 
        message: 'Your account is already verified. Please log in.' 
      });
    }

    console.log(`[VERIFY] Generating verification token for user: ${user.id}`);
    
    // Generate a new verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration
    
    // Clean up any existing verification tokens for this user
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
    
    // Update the user's verification token field as well
    await storage.updateUser(user.id, {
      verificationToken: token
    });
    
    // Get base URL for verification link
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://tickd.me' 
      : `${req.protocol}://${req.get('host')}`;
    
    // Import email utilities
    const emailModule = await import('../utils/email-service');
    
    // Generate and send verification email
    const emailContent = emailModule.getRegistrationEmailContent(token, baseUrl);
    const emailSent = await emailModule.sendEmail({
      to: email,
      subject: 'Please Verify Your Email - Tickd',
      htmlContent: emailContent
    });
    
    if (emailSent) {
      console.log(`[VERIFY] Verification email sent to ${email}`);
      
      // Log the verification link in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV] Verification link: ${baseUrl}/verify-email?token=${token}`);
      }
      
      return res.status(200).json({ 
        message: 'Verification email has been sent. Please check your inbox.' 
      });
    } else {
      console.error(`[VERIFY] Failed to send verification email to ${email}`);
      return res.status(500).json({ 
        message: 'Failed to send verification email. Please try again later.' 
      });
    }
  } catch (error) {
    console.error('[VERIFY] Error resending verification email:', error);
    return res.status(500).json({ 
      message: 'An unexpected error occurred. Please try again.' 
    });
  }
});

export default router;