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

// Routes that don't require authentication
router.get('/verify-email-change', verifyEmailChange);

// Apply authentication middleware to protected profile routes
router.use(authenticate);

// Protected profile routes
router.put('/password', updatePassword);
router.put('/update', updateProfile);
router.put('/profile', updateProfile); // Add this route for /api/auth/profile
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
        expiresAt: pendingEmailChange.expiresAt,
        token: pendingEmailChange.token
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