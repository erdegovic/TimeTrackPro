import { Request, Response, NextFunction } from 'express';
import '../types/session';

// Authenticate middleware to check if user is logged in
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // Check for user session
  if (!req.session?.userId) {
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
  
  // Forward directly to the API endpoint that handles verification
  return res.redirect(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
};
