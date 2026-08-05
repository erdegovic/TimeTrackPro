import express from 'express';
import { authenticate } from '../middleware/auth';
import { 
  updatePassword, 
  updateProfile, 
  updateAvatar, 
  verifyEmailChange,
} from '../controllers/profileController';
import { storage } from '../storage';

const router = express.Router();

const serializeUser = (user: Awaited<ReturnType<typeof storage.getUser>>) => {
  if (!user) return undefined;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    subscriptionPlan: user.subscriptionPlan,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionChangedAt: user.subscriptionChangedAt,
  };
};

// Routes that don't require authentication
router.get('/verify-email-change', verifyEmailChange);

// Apply authentication middleware to protected profile routes
router.use(authenticate);

// Protected profile routes
router.put('/password', updatePassword);
router.put('/update', updateProfile);
// Override the profile route with our custom implementation
router.put('/profile', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const { email, ...otherProfileData } = req.body;

    // Get the current user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Process email change if needed
    if (email && email !== user.email) {
      console.log(`Email change detected from ${user.email} to ${email}`);
      
      // Check if new email already exists
      const emailExists = await storage.getUserByEmail(email);
      if (emailExists) {
        return res.status(409).json({ message: 'Email already in use by another account' });
      }
      
      // Generate a verification token
      const token = require('crypto').randomBytes(32).toString('hex');
      const expiration = new Date();
      expiration.setHours(expiration.getHours() + 24); // 24 hour expiration
      
      // Store verification request in database
      await storage.createVerification({
        userId: userId,
        token,
        newEmail: email,
        type: 'email_change',
        expiresAt: expiration,
        createdAt: new Date()
      });
      
      // Send verification email
      console.log(`[DEV MODE] Verification link: ${req.protocol}://${req.hostname}/verify-email-change?token=${token}`);
      
      // Update other profile data without email
      const updatedUser = await storage.updateUser(userId, otherProfileData);
      
      if (updatedUser) {
        return res.status(200).json({
          message: 'Profile updated. Please check your new email address to verify the change.',
          emailChangeRequested: true,
          pendingEmail: email,
          user: serializeUser(updatedUser)
        });
      } else {
        return res.status(500).json({ message: 'Failed to update profile' });
      }
    } else {
      // Just update the normal profile data (no email change)
      const updatedUser = await storage.updateUser(userId, req.body);
      
      if (updatedUser) {
        return res.status(200).json({
          message: 'Profile updated successfully',
          user: serializeUser(updatedUser)
        });
      } else {
        return res.status(500).json({ message: 'Failed to update profile' });
      }
    }
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
});
router.post('/avatar', updateAvatar);

// Add endpoint to check for pending email changes
router.get('/pending-email-change', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Find any pending email change verification
    const verifications = await storage.getVerificationsByUser(userId);
    const pendingEmailChange = verifications.find(v => 
      v.type === 'email_change' && v.newEmail && new Date() < v.expiresAt
    );

    if (pendingEmailChange) {
      return res.json({ 
        pendingEmail: pendingEmailChange.newEmail,
        expiresAt: pendingEmailChange.expiresAt
      });
    }
    
    return res.json({ pendingEmail: null });
  } catch (error) {
    console.error('Error checking pending email changes:', error);
    return res.status(500).json({ message: 'Failed to check pending email changes' });
  }
});

// Add endpoint to cancel a pending email change
router.delete('/cancel-email-change', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Find any pending email change verification
    const verifications = await storage.getVerificationsByUser(userId);
    const pendingEmailChange = verifications.find(v => 
      v.type === 'email_change' && v.newEmail && new Date() < v.expiresAt
    );

    if (pendingEmailChange) {
      // Cancel the verification by deleting it
      await storage.deleteVerification(pendingEmailChange.token);
      return res.json({ message: 'Email change cancelled successfully' });
    }
    
    return res.status(404).json({ message: 'No pending email change found' });
  } catch (error) {
    console.error('Error cancelling email change:', error);
    return res.status(500).json({ message: 'Failed to cancel email change' });
  }
});

export default router;
