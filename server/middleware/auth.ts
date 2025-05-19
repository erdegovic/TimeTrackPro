import { Request, Response, NextFunction } from 'express';
import { getSession } from '../utils/auth';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Extend Express Request type to include user
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
    // Get session ID from cookie
    const sessionId = req.cookies.sessionId;
    
    if (!sessionId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }
    
    // Verify session
    const session = await getSession(sessionId);
    
    if (!session) {
      // Clear invalid session cookie
      res.clearCookie('sessionId');
      
      return res.status(401).json({ 
        success: false, 
        message: 'Session expired or invalid' 
      });
    }
    
    // Get user
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, session.userId));
    
    if (!user) {
      // Clear session cookie if user not found
      res.clearCookie('sessionId');
      
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      // Clear session cookie if user is not active
      res.clearCookie('sessionId');
      
      return res.status(401).json({ 
        success: false, 
        message: 'Account is not active' 
      });
    }
    
    // Attach user and session to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
    
    req.session = session;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred during authentication' 
    });
  }
}

/**
 * Authorization middleware - verifies user role
 */
export function authorize(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Forbidden - Insufficient permissions' 
      });
    }
    
    next();
  };
}