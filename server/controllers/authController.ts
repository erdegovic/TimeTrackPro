import { Request, Response } from 'express';
import { storage } from '../storage';
import {
  hashPassword,
  comparePassword, 
  generateJwtToken,
  generateToken,
  createVerificationToken,
  verifyToken,
  deleteVerificationToken,
  validateCaptcha
} from '../utils/auth';
import { 
  sendVerificationEmail, 
  sendPasswordResetEmail 
} from '../utils/email';
import { 
  userRegisterSchema, 
  userLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema 
} from '@shared/schema';

/**
 * Register a new user
 */
export async function register(req: Request, res: Response) {
  try {
    // Validate request body
    const result = userRegisterSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: 'Invalid input data',
        errors: result.error.errors
      });
    }

    const { username, email, password, firstName, lastName, captchaToken } = result.data;

    // Validate captcha token
    if (!captchaToken) {
      return res.status(400).json({ message: 'CAPTCHA verification required' });
    }

    const isValidCaptcha = await validateCaptcha(captchaToken);
    if (!isValidCaptcha) {
      return res.status(400).json({ message: 'CAPTCHA verification failed' });
    }

    // Check if user already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await storage.createUser({
      username,
      email,
      password: hashedPassword,
      firstName: firstName || null,
      lastName: lastName || null,
      status: 'pending',
      role: 'user',
    });

    // Create verification token
    const verificationToken = await createVerificationToken(user.id, 'email');
    
    // Send verification email
    await sendVerificationEmail(email, verificationToken);

    return res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.'
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
}

/**
 * Verify email
 */
export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token } = req.params;

    // Verify token
    const userId = await verifyToken(token, 'email');
    if (!userId) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    // Get user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user status to active
    await storage.updateUser(user.id, { status: 'active' });

    // Delete verification token
    await deleteVerificationToken(token);

    return res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ message: 'Email verification failed. Please try again.' });
  }
}

/**
 * Log in user
 */
export async function login(req: Request, res: Response) {
  try {
    // Validate request body
    const result = userLoginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: 'Invalid input data',
        errors: result.error.errors
      });
    }

    const { usernameOrEmail, password } = result.data;

    // Find user by username or email
    const user = await storage.getUserByUsername(usernameOrEmail);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account not activated. Please check your email for verification link.' });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateJwtToken(user.id);

    // Set session
    if (req.session) {
      req.session.userId = user.id;
      req.session.token = token;
    }

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
}

/**
 * Forgot password - sends reset email
 */
export async function forgotPassword(req: Request, res: Response) {
  try {
    // Validate request body
    const result = forgotPasswordSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: 'Invalid input data',
        errors: result.error.errors
      });
    }

    const { email } = result.data;

    // Find user by email
    const user = await storage.getUserByEmail(email);
    if (!user) {
      // Don't reveal that the email doesn't exist
      return res.status(200).json({ 
        message: 'If your email is registered, you will receive a password reset link shortly.'
      });
    }

    // Create reset token
    const resetToken = await createVerificationToken(user.id, 'password_reset');
    
    // Send password reset email
    await sendPasswordResetEmail(email, resetToken);

    return res.status(200).json({ 
      message: 'If your email is registered, you will receive a password reset link shortly.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Failed to process request. Please try again.' });
  }
}

/**
 * Reset password
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    // Validate request body
    const result = resetPasswordSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: 'Invalid input data',
        errors: result.error.errors
      });
    }

    const { token, password } = result.data;

    // Verify token
    const userId = await verifyToken(token, 'password_reset');
    if (!userId) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Get user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Update user password
    await storage.updateUser(user.id, { password: hashedPassword });

    // Delete reset token
    await deleteVerificationToken(token);

    return res.status(200).json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Password reset failed. Please try again.' });
  }
}

/**
 * Logout user
 */
export async function logout(req: Request, res: Response) {
  try {
    // Clear session
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
          return res.status(500).json({ message: 'Logout failed. Please try again.' });
        }
        res.clearCookie('connect.sid');
        return res.status(200).json({ message: 'Logged out successfully' });
      });
    } else {
      return res.status(200).json({ message: 'Logged out successfully' });
    }
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ message: 'Logout failed. Please try again.' });
  }
}