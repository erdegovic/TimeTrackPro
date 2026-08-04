import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    oauthState?: string;
    oauthNonce?: string;
    oauthCodeVerifier?: string;
    oauthReturnTo?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
      };
    }
  }
}
