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
  
  // In development, log the verification URL for easier debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('Development testing mode - verification link available');
    console.log('Verification URL:', `${req.protocol}://${req.get('host')}${req.originalUrl}`);
  }
  
  // Determine which page to redirect to based on URL path
  const isEmailChange = req.path.includes('verify-email-change');
  
  // Instead of redirecting to verify-email route, we'll serve the HTML page directly
  // This will allow the client-side JavaScript to properly access the token from the URL
  return res.sendFile('index.html', { root: './client/dist' });
};