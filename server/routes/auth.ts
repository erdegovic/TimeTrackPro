import { Router } from 'express';
import { 
  register, 
  verifyEmail, 
  login, 
  forgotPassword, 
  resetPassword, 
  logout, 
  getCurrentUser 
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Auth routes
router.post('/register', register);
router.get('/verify-email/:token', verifyEmail);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);
router.get('/user', authenticate, getCurrentUser);

export default router;