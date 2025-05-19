import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// JWT secret from environment or a default for development
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';
const JWT_EXPIRY = '24h';

/**
 * Hashes a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compares a password with a hashed password
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Generates a JWT token
 */
export function generateToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verifies a JWT token
 */
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Generates a random token for email verification
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a reset password token with expiry
 */
export function generatePasswordResetToken(): { token: string; expires: Date } {
  // Token expires in 1 hour
  const expires = new Date();
  expires.setHours(expires.getHours() + 1);
  
  return {
    token: crypto.randomBytes(32).toString('hex'),
    expires
  };
}

/**
 * Checks if a token has expired
 */
export function isTokenExpired(expires: Date): boolean {
  return new Date() > expires;
}

/**
 * Middleware to check if user is authenticated
 */
export function authenticate(req: any, res: any, next: any) {
  const userId = req.session?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  req.user = { id: userId };
  next();
}

/**
 * Middleware to check if user is an admin
 */
export function requireAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  next();
}