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

export default router;