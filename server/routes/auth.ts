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
import { authenticate } from '../utils/auth';

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
router.put('/profile', (req, res) => {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const { firstName, lastName, email, username } = req.body;
    
    // Log the incoming profile update
    console.log(`Profile update request for user ${userId}:`, { firstName, lastName, email, username });
    
    // In a real application, we would update the user in the database
    // For the demo, we'll simulate success
    return res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: userId,
        firstName,
        lastName,
        email,
        username
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Avatar upload endpoint
router.post('/avatar', (req, res) => {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // In a real application, we would store the avatar image
    // For the demo, we'll simulate success
    console.log('Avatar upload request received');
    
    return res.status(200).json({
      message: 'Avatar updated successfully',
      avatarUrl: req.body.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e'
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return res.status(500).json({ message: 'Failed to update avatar' });
  }
});

export default router;