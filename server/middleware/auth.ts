import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { verifyJwtToken } from '../utils/auth';

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
        // Check if the user is logged in via session
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Get user from storage
        const user = await storage.getUser(req.session.userId);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        // Check if token is still valid
        if (req.session.token) {
            const tokenPayload = verifyJwtToken(req.session.token);
            if (!tokenPayload) {
                return res.status(401).json({ message: 'Session expired' });
            }
        }

        // Attach user to request
        req.user = user;
        
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ message: 'Authentication failed' });
    }
}

/**
 * Authorization middleware - verifies user role
 */
export function authorize(roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Check if user is authenticated
            if (!req.user) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            // Check if user has the required role
            if (!roles.includes(req.user.role)) {
                return res.status(403).json({ message: 'Insufficient permissions' });
            }

            next();
        } catch (error) {
            console.error('Authorization error:', error);
            return res.status(403).json({ message: 'Authorization failed' });
        }
    };
}

/**
 * Get current user middleware - attaches user to request if authenticated
 */
export async function getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
        // If no session or no userId in session, continue without user
        if (!req.session || !req.session.userId) {
            return next();
        }

        // Get user from storage
        const user = await storage.getUser(req.session.userId);
        if (!user) {
            return next();
        }

        // Attach user to request
        req.user = user;
        
        next();
    } catch (error) {
        console.error('Get current user error:', error);
        next();
    }
}