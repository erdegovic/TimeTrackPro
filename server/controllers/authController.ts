import { Request, Response } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { 
  userRegisterSchema,
  userLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type User
} from '@shared/schema';
import { 
  hashPassword, 
  comparePassword, 
  createVerificationToken,
  verifyToken,
  deleteVerificationToken,
  validateCaptcha,
  createSession
} from '../utils/auth';
import {
  sendVerificationEmail,
  sendPasswordResetEmail
} from '../utils/email';

/**
 * Register a new user
 */
export async function register(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = userRegisterSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }
    
    const { username, email, password, firstName, lastName, captchaToken } = validationResult.data;
    
    // Validate captcha
    const isCaptchaValid = await validateCaptcha(captchaToken);
    
    if (!isCaptchaValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'CAPTCHA validation failed. Please try again.' 
      });
    }
    
    // Check if user already exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    if (existingUser.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is already registered' 
      });
    }
    
    // Check if username is taken
    const existingUsername = await db.select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    
    if (existingUsername.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username is already taken' 
      });
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Create user
    const [user] = await db.insert(users)
      .values({
        username,
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        status: 'pending',
        role: 'user',
      })
      .returning();
    
    // Create verification token
    const verificationToken = await createVerificationToken(user.id, 'email');
    
    // Send verification email
    await sendVerificationEmail(email, username, verificationToken);
    
    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred during registration' 
    });
  }
}

/**
 * Verify email
 */
export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Verification token is required' 
      });
    }
    
    // Verify token
    const userId = await verifyToken(token, 'email');
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification token' 
      });
    }
    
    // Update user status
    await db.update(users)
      .set({ status: 'active' })
      .where(eq(users.id, userId));
    
    // Delete verification token
    await deleteVerificationToken(token);
    
    return res.status(200).json({
      success: true,
      message: 'Email verification successful. You can now log in.',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred during email verification' 
    });
  }
}

/**
 * Log in user
 */
export async function login(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = userLoginSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }
    
    const { usernameOrEmail, password } = validationResult.data;
    
    // Find user by username or email
    const [user] = await db.select()
      .from(users)
      .where(
        usernameOrEmail.includes('@') 
          ? eq(users.email, usernameOrEmail) 
          : eq(users.username, usernameOrEmail)
      );
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Account is not active. Please verify your email.' 
      });
    }
    
    // Check password
    const isPasswordValid = await comparePassword(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Create session
    const session = await createSession(user.id);
    
    // Set session cookie
    res.cookie('sessionId', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred during login' 
    });
  }
}

/**
 * Forgot password - sends reset email
 */
export async function forgotPassword(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = forgotPasswordSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }
    
    const { email } = validationResult.data;
    
    // Find user by email
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, email));
    
    // If no user is found, still return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link',
      });
    }
    
    // Create password reset token
    const resetToken = await createVerificationToken(user.id, 'password_reset');
    
    // Send password reset email
    await sendPasswordResetEmail(email, resetToken);
    
    return res.status(200).json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred while processing your request' 
    });
  }
}

/**
 * Reset password
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = resetPasswordSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }
    
    const { token, password } = validationResult.data;
    
    // Verify token
    const userId = await verifyToken(token, 'password_reset');
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(password);
    
    // Update password
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
    
    // Delete reset token
    await deleteVerificationToken(token);
    
    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred while resetting your password' 
    });
  }
}

/**
 * Logout user
 */
export async function logout(req: Request, res: Response) {
  try {
    // Clear session cookie
    res.clearCookie('sessionId');
    
    return res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred during logout' 
    });
  }
}