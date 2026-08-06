import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    authMethod?: "password" | "google";
    authenticatedAt?: number;
    adminReauthenticatedAt?: number;
    oauthState?: string;
    oauthNonce?: string;
    oauthCodeVerifier?: string;
    oauthReturnTo?: string;
    oauthRegistrationPlan?: "free" | "pro" | "ultimate";
    oauthRegistrationBillingInterval?: "monthly" | "annual";
    oauthTermsVersion?: string;
    oauthPrivacyVersion?: string;
    gmailOauthState?: string;
    gmailOauthCodeVerifier?: string;
    gmailOauthNonce?: string;
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
