import express from 'express';
import { authenticate } from '../middleware/auth';
import { updatePassword, updateProfile, updateAvatar } from '../controllers/profileController';

const router = express.Router();

// Apply authentication middleware to all profile routes
router.use(authenticate);

// Profile routes
router.put('/password', updatePassword);
router.put('/update', updateProfile);
router.post('/avatar', updateAvatar);

export default router;