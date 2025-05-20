import { Request, Response } from 'express';
import { storage } from '../storage';
import {
  hashPassword,
  comparePassword, 
  generateToken,
  verifyToken,
  generateVerificationToken,
  isTokenExpired,
  generatePasswordResetToken
} from '../utils/auth';
import { 
  sendVerificationEmail, 
  sendPasswordResetEmail
} from '../utils/email';
import { validateCaptcha } from '../utils/captcha';
import { 
  userRegisterSchema, 
  userLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from '@shared/schema';
import { z } from 'zod';

/**
 * Register a new user
 */
export async function register(req: Request, res: Response) {
  try {
    // Validate request body against schema
    const { username, email, password, firstName, lastName, captchaToken } = 
      userRegisterSchema.parse(req.body);
    
    // Validate captcha if provided
    if (captchaToken) {
      const isValidCaptcha = await validateCaptcha(captchaToken);
      if (!isValidCaptcha) {
        return res.status(400).json({ message: 'CAPTCHA verification failed' });
      }
    }

    // Check if user already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    // Check if email already exists
    const emailExists = await storage.getUserByEmail(email);
    if (emailExists) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create verification token
    const verificationToken = generateVerificationToken();

    // Create user
    const user = await storage.createUser({
      username,
      email,
      password: hashedPassword,
      firstName: firstName || null,
      lastName: lastName || null,
      role: 'user',
      status: 'pending', // User starts as pending until email is verified
      verificationToken,
      resetPasswordToken: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(
      email, 
      username,
      verificationToken
    );

    if (!emailSent) {
      console.warn(`Failed to send verification email to ${email}`);
      // Continue, don't return error - user can request a new verification email
      
      // For easier testing, add verification link to response in development environment
      if (process.env.NODE_ENV === 'development') {
        const baseUrl = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000"}`;
        const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
        console.log('==============================================================');
        console.log('DEVELOPMENT MODE: Use this verification link to verify account:');
        console.log(verificationUrl);
        console.log('==============================================================');
      }
    }

    // In development mode, include verification token in response for easier testing
    const responseData = {
      message: 'Registration successful! Please verify your email to activate your account.',
      userId: user.id
    };
    
    if (process.env.NODE_ENV === 'development') {
      // For development testing only - never do this in production
      const baseUrl = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000"}`;
      const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
      
      // Add testing info to response
      Object.assign(responseData, {
        _devInfo: {
          verificationToken: verificationToken,
          verificationUrl: verificationUrl
        }
      });
    }
    
    return res.status(201).json(responseData);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid registration data', 
        errors: error.errors 
      });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
}

/**
 * Verify email
 */
export async function verifyEmail(req: Request, res: Response) {
  try {
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(400).json({ message: 'Verification token is required.' });
    }
    
    // Find verification entry
    const verification = await storage.getVerificationByToken(token);
    
    if (!verification) {
      return res.status(400).json({ message: 'Invalid or expired verification token.' });
    }
    
    // Find user
    const user = await storage.getUser(verification.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    // Update user status
    await storage.updateUser(user.id, { 
      status: 'active',
      verificationToken: null,
      updatedAt: new Date() 
    });
    
    // Remove verification token
    await storage.deleteVerification(token);
    
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
    const { email, password } = userLoginSchema.parse(req.body);
    
    // Debug info
    console.log(`Login attempt with email: ${email}`);
    
    // Find user by email
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    
    console.log(`User found: ${user.email}, id: ${user.id}, status: ${user.status}`);
    
    // Check user status
    if (user.status === 'pending') {
      console.log('User status is pending');
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }
    
    if (user.status === 'inactive') {
      console.log('User status is inactive');
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
    }
    
    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    console.log(`Password validation result: ${isValidPassword}`);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    
    // Set up session
    req.session.userId = user.id;
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    
    return res.status(200).json({ 
      message: 'Login successful', 
      user: userWithoutPassword 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid login data', 
        errors: error.errors 
      });
    }
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
}

/**
 * Forgot password - sends reset email
 */
export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    
    // Find user by email
    const user = await storage.getUserByEmail(email);
    
    // Don't reveal if user exists or not for security
    if (!user) {
      return res.status(200).json({ 
        message: 'If your email is registered, you will receive a password reset link.' 
      });
    }
    
    // Generate reset token
    const { token, expires } = generatePasswordResetToken();
    
    // Update user
    await storage.updateUser(user.id, { 
      resetPasswordToken: token,
      updatedAt: new Date()
    });
    
    // Send password reset email
    const emailSent = await sendPasswordResetEmail(
      email,
      user.email,
      token
    );
    
    if (!emailSent) {
      console.error('Failed to send password reset email');
      return res.status(500).json({ message: 'Failed to send password reset email. Please try again.' });
    }
    
    return res.status(200).json({ 
      message: 'If your email is registered, you will receive a password reset link.' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid email', 
        errors: error.errors 
      });
    }
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Failed to process request. Please try again.' });
  }
}

/**
 * Reset password
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    
    // Find user by reset token
    const user = await storage.getUserByResetToken(token);
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(password);
    
    // Update user
    await storage.updateUser(user.id, { 
      password: hashedPassword,
      resetPasswordToken: null,
      updatedAt: new Date()
    });
    
    return res.status(200).json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid password reset data', 
        errors: error.errors 
      });
    }
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
      req.session.destroy((err: Error) => {
        if (err) {
          console.error('Session destruction error:', err);
          return res.status(500).json({ message: 'Logout failed. Please try again.' });
        }
        res.clearCookie('connect.sid');
        // Redirect to login page with logout success parameter
        return res.redirect('/login?logout=true');
      });
    } else {
      // Redirect to login page with logout success parameter
      return res.redirect('/login?logout=true');
    }
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ message: 'Logout failed. Please try again.' });
  }
}

/**
 * Get current user
 */
export async function getCurrentUser(req: Request, res: Response) {
  try {
    // User is already validated by the authenticate middleware
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const userId = req.user.id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return sanitized user object (no password)
    const { password, ...userData } = user;
    return res.status(200).json(userData);
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ message: 'Failed to get user information' });
  }
}