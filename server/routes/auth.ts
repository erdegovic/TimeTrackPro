import { Request, Response, NextFunction, Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { storage } from '../storage';
import { verificationTypeEnum } from '@shared/schema';

// Create router
const router = Router();

// Get pending email change
const getPendingEmailChange = async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Fetch verifications for this user
    const verifications = await storage.getVerificationsByUser(userId);
    const pendingEmail = verifications.find(v => 
      v.type === 'email_change' && 
      v.expiresAt > new Date() && 
      v.newEmail
    );

    return res.status(200).json({ 
      pendingEmail: pendingEmail ? pendingEmail.newEmail : null 
    });
  } catch (error) {
    console.error('Error getting pending email change:', error);
    return res.status(500).json({ message: 'Failed to get pending email change' });
  }
};

// Update user profile
const updateProfile = async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { firstName, lastName, email } = req.body;

    // Fetch the current user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Profile update request for user', userId, ':', req.body);

    // Check if email is being changed
    if (email && email !== user.email) {
      // Create verification token
      const token = crypto.randomBytes(32).toString('hex');
      const expiration = new Date();
      expiration.setHours(expiration.getHours() + 24); // 24 hour expiration
      
      // Store verification in database
      await storage.createVerification({
        userId: userId,
        token,
        newEmail: email,
        type: 'email_change',
        expiresAt: expiration,
        createdAt: new Date()
      });
      
      // Send verification email (in development mode, just log the link)
      console.log(`[DEV MODE] Email verification link: ${req.protocol}://${req.hostname}/verify-email-change?token=${token}`);
      
      // Update first/last name only, not email yet
      const updatedUser = await storage.updateUser(userId, { 
        firstName, 
        lastName 
      });
      
      return res.status(200).json({ 
        message: 'Profile updated successfully. Email verification required.',
        emailChangeRequested: true,
        pendingEmail: email,
        user: updatedUser
      });
    } else {
      // Just update the profile without email verification
      const updatedUser = await storage.updateUser(userId, { 
        firstName, 
        lastName
      });
      
      return res.status(200).json({ 
        message: 'Profile updated successfully',
        user: updatedUser
      });
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
};

// Cancel email change
const cancelEmailChange = async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Fetch verifications for this user
    const verifications = await storage.getVerificationsByUser(userId);
    for (const verification of verifications) {
      if (verification.type === 'email_change') {
        await storage.deleteVerification(verification.token);
      }
    }

    return res.status(200).json({ message: 'Email change canceled successfully' });
  } catch (error) {
    console.error('Error canceling email change:', error);
    return res.status(500).json({ message: 'Failed to cancel email change' });
  }
};

// Verify email change
const verifyEmailChange = async (req: Request, res: Response) => {
  try {
    // Extract token from query
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Invalid token' });
    }

    // Find verification record
    const verification = await storage.getVerificationByToken(token);
    if (!verification) {
      return res.status(404).json({ message: 'Verification not found' });
    }

    // Check if verification is expired
    if (verification.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Verification expired' });
    }

    // Check if verification is for email change
    if (verification.type !== 'email_change' || !verification.newEmail) {
      return res.status(400).json({ message: 'Invalid verification type' });
    }

    // Update user's email
    const user = await storage.getUser(verification.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await storage.updateUser(verification.userId, { email: verification.newEmail });

    // Delete verification record
    await storage.deleteVerification(token);

    return res.status(200).json({ message: 'Email updated successfully' });
  } catch (error) {
    console.error('Error verifying email change:', error);
    return res.status(500).json({ message: 'Failed to verify email change' });
  }
};

// Update password
const updatePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;
    
    // Get current user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const passwordValid = await bcrypt.compare(currentPassword, user.password);
    if (!passwordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user's password
    await storage.updateUser(userId, { password: hashedPassword });

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json({ message: 'Failed to update password' });
  }
};

// Update avatar
const updateAvatar = async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { avatarUrl } = req.body;
    
    // Update user's profile image
    const updatedUser = await storage.updateUser(userId, { 
      profileImageUrl: avatarUrl 
    });

    return res.status(200).json({ 
      message: 'Avatar updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating avatar:', error);
    return res.status(500).json({ message: 'Failed to update avatar' });
  }
};

// Get current user
const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return user without password
    const { password, ...userWithoutPassword } = user;
    
    return res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error('Error getting current user:', error);
    return res.status(500).json({ message: 'Failed to get current user' });
  }
};

// Register routes
router.get('/pending-email-change', getPendingEmailChange);
router.put('/profile', updateProfile);
router.delete('/cancel-email-change', cancelEmailChange);
router.get('/verify-email-change', verifyEmailChange);
router.put('/password', updatePassword);
router.post('/avatar', updateAvatar);
router.get('/user', getCurrentUser);

export default router;