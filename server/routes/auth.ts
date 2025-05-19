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

export default router;