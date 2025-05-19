import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

// Add user to Request type
declare global {
    namespace Express {
        interface Request {
            user?: any;
            session?: any;
        }
    }
}

/**
 * Authentication middleware - verifies session and attaches user to request
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Check if user is authenticated via session
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Unauthorized - Please log in' });
    }

    // Get user from storage
    const user = await storage.getUser(req.session.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Check if user is active
    if (user.status === 'inactive') {
      return res.status(403).json({ message: 'Your account is inactive. Please contact support.' });
    }
    
    // Attach user to request object for use in route handlers
    req.user = user;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'Authentication failed. Please try again.' });
  }
}

/**
 * Authorization middleware - verifies user role
 */
export function authorize(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized - Please log in' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden - Insufficient permissions' });
    }
    
    next();
  };
}

/**
 * Get current user middleware - attaches user to request if authenticated
 * This is a softer version of authenticate that doesn't return 401 errors
 */
export async function getCurrentUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.session && req.session.userId) {
      const user = await storage.getUser(req.session.userId);
      if (user && user.status === 'active') {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    console.error('Get current user error:', error);
    next();
  }
}