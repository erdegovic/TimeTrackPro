import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users, verifications, sessions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { User, Session } from '@shared/schema';

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '7d'; // Token expires in 7 days

/**
 * Generate a secure random token
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
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify a JWT token
 */
export function verifyJwtToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Create a session
 */
export async function createSession(userId: number): Promise<Session> {
  const sessionId = generateToken(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Session expires in 7 days
  
  const [session] = await db.insert(sessions)
    .values({
      id: sessionId,
      userId,
      expiresAt,
    })
    .returning();

  return session;
}

/**
 * Get a session by ID
 */
export async function getSession(sessionId: string): Promise<Session | undefined> {
  const [session] = await db.select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  
  if (!session || session.expiresAt < new Date()) {
    return undefined;
  }
  
  return session;
}

/**
 * Create a verification token
 */
export async function createVerificationToken(
  userId: number,
  type: 'email' | 'password_reset'
): Promise<string> {
  const token = generateToken(32);
  const expiresAt = new Date();
  
  if (type === 'password_reset') {
    expiresAt.setHours(expiresAt.getHours() + 1); // Password reset tokens expire in 1 hour
  } else {
    expiresAt.setHours(expiresAt.getHours() + 24); // Email verification tokens expire in 24 hours
  }
  
  await db.insert(verifications)
    .values({
      userId,
      token,
      type,
      expiresAt,
    });
    
  return token;
}

/**
 * Verify a token and get the user ID
 */
export async function verifyToken(
  token: string,
  type: 'email' | 'password_reset'
): Promise<number | undefined> {
  const [verification] = await db.select()
    .from(verifications)
    .where(
      and(
        eq(verifications.token, token),
        eq(verifications.type, type)
      )
    );
    
  if (!verification || verification.expiresAt < new Date()) {
    return undefined;
  }
  
  return verification.userId;
}

/**
 * Delete a verification token
 */
export async function deleteVerificationToken(token: string): Promise<void> {
  await db.delete(verifications)
    .where(eq(verifications.token, token));
}

/**
 * Validate a reCAPTCHA token
 */
export async function validateCaptcha(token: string): Promise<boolean> {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    
    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY not set in environment variables');
      return false;
    }
    
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });
    
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Error validating reCAPTCHA:', error);
    return false;
  }
}