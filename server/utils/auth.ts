import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

// JWT token generation
export function generateToken(payload: object, expiresIn = '1d'): string {
  const secret = process.env.JWT_SECRET || 'supersecretkey'; // Fallback for development only
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token: string): any {
  const secret = process.env.JWT_SECRET || 'supersecretkey'; // Fallback for development only
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}

// Generate unique tokens for verification (email, password reset)
export function generateVerificationToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
export function isStrongPassword(password: string): boolean {
  // At least 8 characters, with at least 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
}

// Generate password reset token
export function generatePasswordResetToken(): { token: string; expires: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000); // 1 hour
  
  return { token, expires };
}

// Check if password reset token is expired
export function isTokenExpired(tokenExpiry: Date): boolean {
  return new Date() > new Date(tokenExpiry);
}