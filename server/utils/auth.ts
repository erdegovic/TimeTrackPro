import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const TOKEN_EXPIRY = '24h';

/**
 * Generate a random token
 */
export function generateToken(length = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Generate a signed JWT token
 */
export function generateJwtToken(userId: number): string {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

/**
 * Verify a JWT token
 */
export function verifyJwtToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Create a verification token for email verification or password reset
 */
export async function createVerificationToken(
  userId: number,
  type: 'email' | 'password_reset'
): Promise<string> {
  // Generate a random token
  const token = generateToken();
  
  // Calculate expiry date (24 hours for email verification, 1 hour for password reset)
  const expiresAt = new Date();
  if (type === 'email') {
    expiresAt.setHours(expiresAt.getHours() + 24);
  } else {
    expiresAt.setHours(expiresAt.getHours() + 1);
  }
  
  // Store token in database
  await storage.createVerification({
    userId,
    token,
    type,
    expiresAt: expiresAt.toISOString(),
  });
  
  return token;
}

/**
 * Verify a token and get the user ID
 */
export async function verifyToken(
  token: string,
  type: 'email' | 'password_reset'
): Promise<number | null> {
  try {
    // Get verification from database
    const verification = await storage.getVerificationByToken(token);
    if (!verification) {
      return null;
    }
    
    // Check if token is of the correct type
    if (verification.type !== type) {
      return null;
    }
    
    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(verification.expiresAt);
    if (now > expiresAt) {
      return null;
    }
    
    return verification.userId;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Delete a verification token
 */
export async function deleteVerificationToken(token: string): Promise<void> {
  await storage.deleteVerification(token);
}

/**
 * Validate a reCAPTCHA token
 */
export async function validateCaptcha(token: string): Promise<boolean> {
  try {
    // For development/testing purposes, you might want to bypass this check
    if (process.env.NODE_ENV === 'development') {
      // Check if token is the test token
      if (token === '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI') {
        return true;
      }
    }
    
    // Verify token with Google reCAPTCHA API
    const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
    });
    
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('CAPTCHA validation error:', error);
    return false;
  }
}