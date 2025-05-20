import express from 'express';
import { authenticate } from '../middleware/auth';
import { 
  updatePassword, 
  updateProfile, 
  updateAvatar, 
  verifyEmailChange 
} from '../controllers/profileController';

const router = express.Router();

// Routes that don't require authentication
router.get('/verify-email-change', verifyEmailChange);

// Apply authentication middleware to protected profile routes
router.use(authenticate);

// Protected profile routes
router.put('/password', updatePassword);
router.put('/update', updateProfile);
router.post('/avatar', updateAvatar);

export default router;