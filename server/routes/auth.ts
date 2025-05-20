import express from 'express';
import { 
  register, 
  login, 
  logout, 
  verifyEmail, 
  forgotPassword, 
  resetPassword,
  getCurrentUser 
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { storage } from '../storage';

const router = express.Router();

// Authentication routes
router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/user', authenticate, getCurrentUser);

// Profile routes
router.put('/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const { firstName, lastName, email } = req.body;
    
    // Log the incoming profile update
    console.log(`Profile update request for user ${userId}:`, { firstName, lastName, email });
    
    // Update the user in the database
    const updatedUser = await storage.updateUser(userId, {
      firstName,
      lastName,
      email
    });
    
    if (!updatedUser) {
      throw new Error(`Failed to update user profile for ID: ${userId}`);
    }
    
    return res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Avatar upload endpoint
router.post('/avatar', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const { avatarUrl } = req.body;
    
    if (!avatarUrl) {
      return res.status(400).json({ message: 'Avatar URL is required' });
    }
    
    // Store avatar URL in the user profile
    const updatedUser = await storage.updateUser(userId, {
      profileImageUrl: avatarUrl
    });
    
    if (!updatedUser) {
      throw new Error(`Failed to update avatar for user ID: ${userId}`);
    }
    
    console.log('Avatar updated for user:', userId);
    
    return res.status(200).json({
      message: 'Avatar updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return res.status(500).json({ message: 'Failed to update avatar' });
  }
});

export default router;