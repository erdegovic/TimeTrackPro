import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include session and user
declare global {
  namespace Express {
    interface Request {
      session: {
        userId?: number;
        destroy: (callback: (err: Error) => void) => void;
      };
      user?: {
        id: number;
      };
    }
  }
}

// Authenticate middleware to check if user is logged in
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session) {
    req.session = {} as any;
  }
  
  // In development mode, allow access for testing
  if (process.env.NODE_ENV === 'development' && !req.session.userId) {
    // For development testing - set a default user ID
    req.session.userId = 1;
    req.user = { id: 1 };
    next();
    return;
  }
  
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  // Add user object to request
  req.user = { id: req.session.userId };
  next();
};

// Special middleware for verification redirect
export const handleVerificationRedirect = (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token) {
    return res.redirect('/login?error=missing-token');
  }
  
  // Determine which page to redirect to based on URL path
  const isEmailChange = req.path.includes('verify-email-change');
  
  // Redirect to the appropriate frontend verification page
  const redirectPath = isEmailChange ? 'verify-email-change' : 'verify-email';
  return res.redirect(`/${redirectPath}?token=${token}`);
};