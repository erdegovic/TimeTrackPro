import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    oauthState?: string;
    oauthNonce?: string;
    oauthCodeVerifier?: string;
    oauthReturnTo?: string;
    oauthRegistrationPlan?: "free" | "pro" | "ultimate";
    oauthRegistrationBillingInterval?: "monthly" | "annual";
    oauthTermsVersion?: string;
    oauthPrivacyVersion?: string;
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
