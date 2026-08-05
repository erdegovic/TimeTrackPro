import { Request, Response, NextFunction, Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as oidc from 'openid-client';
import { storage } from '../storage';
import { verificationTypeEnum } from '@shared/schema';
import { getBaseUrl } from '../utils/url-helper';
import { isRegistrationPlan, isSubscriptionPlan, subscriptionPlanRank } from '@shared/subscriptions';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  legalAcceptanceSchema,
} from '@shared/legal';
import {
  createEmailVerificationChallenge,
  isEmailVerificationChallengeToken,
  verifyEmailVerificationCode,
} from '../utils/email-verification-code';

// Create router
const router = Router();
let googleConfiguration: Promise<oidc.Configuration> | undefined;

const forgotPasswordRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const resetPasswordRequestSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8),
});

const registrationRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().max(100).nullish(),
  lastName: z.string().trim().max(100).nullish(),
  captchaToken: z.string().nullish(),
  plan: z.enum(['free', 'pro']),
}).and(legalAcceptanceSchema);

const emailCodeRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().regex(/^\d{6}$/),
});

const verificationAttempts = new Map<string, { count: number; resetAt: number }>();
const VERIFICATION_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

const passwordResetResponse = {
  message: 'If that email is registered, you will receive password reset instructions.',
};

const isGoogleAuthConfigured = () => Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

const getGoogleConfiguration = () => {
  if (!isGoogleAuthConfigured()) {
    throw new Error('Google authentication is not configured');
  }

  if (!googleConfiguration) {
    googleConfiguration = oidc.discovery(
      new URL('https://accounts.google.com'),
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
    );
  }

  return googleConfiguration;
};

const saveSession = (req: Request) => new Promise<void>((resolve, reject) => {
  req.session.save((error) => error ? reject(error) : resolve());
});

const regenerateSession = (req: Request) => new Promise<void>((resolve, reject) => {
  req.session.regenerate((error) => error ? reject(error) : resolve());
});

const safeReturnTo = (value: unknown) => {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/';
};

const serializeUser = (user: Awaited<ReturnType<typeof storage.getUser>>) => {
  if (!user) return undefined;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    subscriptionPlan: isSubscriptionPlan(user.subscriptionPlan) ? user.subscriptionPlan : 'free',
    subscriptionStatus: user.subscriptionStatus || 'active',
    subscriptionChangedAt: user.subscriptionChangedAt,
  };
};

// Get pending email change
const getPendingEmailChange = async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Fetch verifications for this user
    const verifications = await storage.getVerificationsByUser(userId);
    const pendingEmail = verifications.find(v => 
      v.type === 'email_change' && 
      v.expiresAt > new Date() && 
      v.newEmail
    );

    return res.status(200).json({ 
      pendingEmail: pendingEmail ? pendingEmail.newEmail : null 
    });
  } catch (error) {
    console.error('Error getting pending email change:', error);
    return res.status(500).json({ message: 'Failed to get pending email change' });
  }
};

// Update user profile
const updateProfile = async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { firstName, lastName, email } = req.body;
    const normalizedEmail = typeof email === 'string'
      ? email.trim().toLowerCase()
      : undefined;

    // Fetch the current user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Profile update request for user', userId, ':', req.body);

    // Check if email is being changed
    if (normalizedEmail && normalizedEmail !== user.email) {
      if (!z.string().email().safeParse(normalizedEmail).success) {
        return res.status(400).json({ message: 'Please enter a valid email address' });
      }

      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({ message: 'That email address is already in use' });
      }

      const existingVerifications = await storage.getVerificationsByUser(userId);
      await Promise.all(
        existingVerifications
          .filter((verification) => verification.type === 'email_change')
          .map((verification) => storage.deleteVerification(verification.token)),
      );

      // Create verification token
      const token = crypto.randomBytes(32).toString('hex');
      const expiration = new Date();
      expiration.setHours(expiration.getHours() + 24); // 24 hour expiration
      
      // Store verification in database
      await storage.createVerification({
        userId: userId,
        token,
        newEmail: normalizedEmail,
        type: 'email_change',
        expiresAt: expiration,
        createdAt: new Date()
      });
      
      // Send verification email
      try {
        const { sendEmail, getEmailVerificationContent } = await import('../utils/email-service');
        const baseUrl = getBaseUrl(req);
        const htmlContent = getEmailVerificationContent(token, baseUrl, normalizedEmail);
        
        const emailSent = await sendEmail({
          to: normalizedEmail,
          subject: 'Confirm your new Tickd email address',
          htmlContent
        });
        
        if (!emailSent) {
          await storage.deleteVerification(token);
          return res.status(503).json({
            message: 'We could not send the confirmation email. Your email address has not changed.',
          });
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(`[DEV MODE] Email verification link: ${baseUrl}/verify-email-change?token=${token}`);
        }
      } catch (error) {
        console.error('Failed to send verification email:', error);
        await storage.deleteVerification(token);
        return res.status(503).json({
          message: 'We could not send the confirmation email. Your email address has not changed.',
        });
      }
      
      // Update first/last name only, not email yet
      const updatedUser = await storage.updateUser(userId, { 
        firstName, 
        lastName 
      });
      
      return res.status(200).json({ 
        message: 'Profile updated successfully. Email verification required.',
        emailChangeRequested: true,
        pendingEmail: normalizedEmail,
        user: serializeUser(updatedUser)
      });
    } else {
      // Just update the profile without email verification
      const updatedUser = await storage.updateUser(userId, { 
        firstName, 
        lastName
      });
      
      return res.status(200).json({ 
        message: 'Profile updated successfully',
        user: serializeUser(updatedUser)
      });
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
};

// Cancel email change
const cancelEmailChange = async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Fetch verifications for this user
    const verifications = await storage.getVerificationsByUser(userId);
    for (const verification of verifications) {
      if (verification.type === 'email_change') {
        await storage.deleteVerification(verification.token);
      }
    }

    return res.status(200).json({ message: 'Email change canceled successfully' });
  } catch (error) {
    console.error('Error canceling email change:', error);
    return res.status(500).json({ message: 'Failed to cancel email change' });
  }
};

// Verify email change
const verifyEmailChange = async (req: Request, res: Response) => {
  try {
    // Extract token from query
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Invalid token' });
    }

    // Find verification record
    const verification = await storage.getVerificationByToken(token);
    if (!verification) {
      return res.status(404).json({ message: 'Verification not found' });
    }

    // Check if verification is expired
    if (verification.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Verification expired' });
    }

    // Check if verification is for email change
    if (verification.type !== 'email_change' || !verification.newEmail) {
      return res.status(400).json({ message: 'Invalid verification type' });
    }

    const existingUser = await storage.getUserByEmail(verification.newEmail);
    if (existingUser && existingUser.id !== verification.userId) {
      await storage.deleteVerification(token);
      return res.status(409).json({ message: 'That email address is already in use' });
    }

    // Update user's email
    const user = await storage.getUser(verification.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await storage.updateUser(verification.userId, { email: verification.newEmail });

    // Delete verification record
    await storage.deleteVerification(token);

    return res.status(200).json({ message: 'Email updated successfully' });
  } catch (error) {
    console.error('Error verifying email change:', error);
    return res.status(500).json({ message: 'Failed to verify email change' });
  }
};

// Update password
const updatePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;
    
    // Get current user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const passwordValid = await bcrypt.compare(currentPassword, user.password);
    if (!passwordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user's password
    await storage.updateUser(userId, { password: hashedPassword });

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json({ message: 'Failed to update password' });
  }
};

// Update avatar
const updateAvatar = async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { avatarUrl } = req.body;
    
    // Update user's profile image
    const updatedUser = await storage.updateUser(userId, { 
      profileImageUrl: avatarUrl 
    });

    return res.status(200).json({ 
      message: 'Avatar updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating avatar:', error);
    return res.status(500).json({ message: 'Failed to update avatar' });
  }
};

// Get current user
const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.status(200).json(serializeUser(user));
  } catch (error) {
    console.error('Error getting current user:', error);
    return res.status(500).json({ message: 'Failed to get current user' });
  }
};

// Resend verification email
const resendVerification = async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get verifications for this user
    const verifications = await storage.getVerificationsByUser(userId);
    const pendingEmailChange = verifications.find(v => 
      v.type === 'email_change' && 
      v.expiresAt > new Date() && 
      v.newEmail
    );

    if (!pendingEmailChange || !pendingEmailChange.newEmail) {
      return res.status(404).json({ message: 'No pending email verification found' });
    }

    // Generate verification URL with production domain for deployment
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://tickd.me'
      : `${req.protocol}://${req.hostname}`;
    const verificationUrl = `${baseUrl}/verify-email-change?token=${pendingEmailChange.token}`;
    
    // Import email utilities and send email
    const { sendEmail, getEmailVerificationContent } = await import('../utils/email-service');
    
    // Send email
    const htmlContent = getEmailVerificationContent(
      pendingEmailChange.token, 
      baseUrl, 
      pendingEmailChange.newEmail
    );
    
    const emailSent = await sendEmail({
      to: pendingEmailChange.newEmail,
      subject: 'Confirm your new Tickd email address',
      htmlContent
    });
    
    if (emailSent) {
      console.log(`Verification email resent successfully to ${pendingEmailChange.newEmail}`);
    } else {
      console.error(`Failed to resend verification email to ${pendingEmailChange.newEmail}`);
      return res.status(503).json({ message: 'We could not send the confirmation email. Please try again.' });
    }
    
    // Log the link in development mode for testing
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV MODE] Resent verification email. Link: ${verificationUrl}`);
    }
    
    return res.status(200).json({ message: 'Verification email resent' });
  } catch (error) {
    console.error('Error resending verification email:', error);
    return res.status(500).json({ message: 'Failed to resend verification email' });
  }
};

// Register routes
router.get('/google/status', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ enabled: isGoogleAuthConfigured() });
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  const validation = forgotPasswordRequestSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  if (!process.env.BREVO_API_KEY) {
    console.error('Password reset requested while transactional email is not configured');
    return res.status(503).json({
      message: 'Password reset email is temporarily unavailable. Please try again later.',
    });
  }

  try {
    const user = await storage.getUserByEmail(validation.data.email);
    if (!user || user.status === 'inactive') {
      return res.status(200).json(passwordResetResponse);
    }

    const existingVerifications = await storage.getVerificationsByUser(user.id);
    const recentReset = existingVerifications.find((verification) => (
      verification.type === 'password_reset'
      && verification.createdAt
      && verification.createdAt.getTime() > Date.now() - 60_000
    ));

    if (recentReset) {
      return res.status(200).json(passwordResetResponse);
    }

    await Promise.all(
      existingVerifications
        .filter((verification) => verification.type === 'password_reset')
        .map((verification) => storage.deleteVerification(verification.token)),
    );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await storage.createVerification({
      userId: user.id,
      token,
      type: 'password_reset',
      newEmail: null,
      expiresAt,
      createdAt: new Date(),
    });
    await storage.updateUser(user.id, { resetPasswordToken: token });

    const { getPasswordResetEmailContent, sendEmail } = await import('../utils/email-service');
    const sent = await sendEmail({
      to: user.email,
      subject: 'Reset your Tickd password',
      htmlContent: getPasswordResetEmailContent(token, getBaseUrl(req)),
    });

    if (!sent) {
      await storage.deleteVerification(token);
      await storage.updateUser(user.id, { resetPasswordToken: null });
      console.error('Password reset email delivery failed');
    }

    return res.status(200).json(passwordResetResponse);
  } catch (error) {
    console.error('Forgot password request failed:', error);
    return res.status(500).json({ message: 'Unable to process the request. Please try again.' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const validation = resetPasswordRequestSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ message: 'Invalid password reset request.' });
  }

  try {
    const verification = await storage.getVerificationByToken(validation.data.token);
    if (!verification || verification.type !== 'password_reset') {
      return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
    }

    if (verification.expiresAt.getTime() <= Date.now()) {
      await storage.deleteVerification(verification.token);
      return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
    }

    const user = await storage.getUser(verification.userId);
    if (!user || user.status === 'inactive') {
      await storage.deleteVerification(verification.token);
      return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
    }

    const password = await bcrypt.hash(validation.data.password, 12);
    await storage.updateUser(user.id, {
      password,
      resetPasswordToken: null,
    });
    await storage.deleteVerification(verification.token);

    return res.status(200).json({ message: 'Your password has been reset successfully.' });
  } catch (error) {
    console.error('Password reset failed:', error);
    return res.status(500).json({ message: 'Unable to reset the password. Please try again.' });
  }
});

router.get('/google', async (req: Request, res: Response) => {
  try {
    const configuration = await getGoogleConfiguration();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;

    req.session.oauthCodeVerifier = codeVerifier;
    req.session.oauthState = state;
    req.session.oauthNonce = nonce;
    req.session.oauthReturnTo = safeReturnTo(req.query.returnTo);
    const registrationPlan = isRegistrationPlan(req.query.plan)
      ? req.query.plan
      : undefined;
    const legalAcceptance = legalAcceptanceSchema.safeParse({
      acceptedTerms: req.query.acceptedTerms === 'true',
      termsVersion: req.query.termsVersion,
      privacyVersion: req.query.privacyVersion,
    });
    if (registrationPlan && !legalAcceptance.success) {
      return res.redirect(`/register?plan=${registrationPlan}&error=accept-terms`);
    }
    req.session.oauthRegistrationPlan = registrationPlan;
    req.session.oauthTermsVersion = legalAcceptance.success
      ? legalAcceptance.data.termsVersion
      : undefined;
    req.session.oauthPrivacyVersion = legalAcceptance.success
      ? legalAcceptance.data.privacyVersion
      : undefined;
    await saveSession(req);

    const authorizationUrl = oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });

    res.redirect(authorizationUrl.href);
  } catch (error) {
    console.error('Unable to start Google authentication:', error);
    res.redirect('/login?error=google-unavailable');
  }
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const codeVerifier = req.session.oauthCodeVerifier;
  const expectedState = req.session.oauthState;
  const expectedNonce = req.session.oauthNonce;
  const returnTo = safeReturnTo(req.session.oauthReturnTo);
  const registrationPlan = req.session.oauthRegistrationPlan;
  const termsVersion = req.session.oauthTermsVersion;
  const privacyVersion = req.session.oauthPrivacyVersion;

  delete req.session.oauthCodeVerifier;
  delete req.session.oauthState;
  delete req.session.oauthNonce;
  delete req.session.oauthReturnTo;
  delete req.session.oauthRegistrationPlan;
  delete req.session.oauthTermsVersion;
  delete req.session.oauthPrivacyVersion;

  if (!codeVerifier || !expectedState || !expectedNonce) {
    return res.redirect('/login?error=google-session-expired');
  }

  try {
    const configuration = await getGoogleConfiguration();
    const callbackUrl = new URL(req.originalUrl, getBaseUrl(req));
    const tokens = await oidc.authorizationCodeGrant(
      configuration,
      callbackUrl,
      {
        pkceCodeVerifier: codeVerifier,
        expectedState,
        expectedNonce,
      },
    );
    const claims = tokens.claims();

    const subject = typeof claims?.sub === 'string' ? claims.sub : null;
    const emailClaim = typeof claims?.email === 'string' ? claims.email : null;
    const givenName = typeof claims?.given_name === 'string' ? claims.given_name : null;
    const familyName = typeof claims?.family_name === 'string' ? claims.family_name : null;
    const picture = typeof claims?.picture === 'string' ? claims.picture : null;

    if (!subject || !emailClaim || claims?.email_verified !== true) {
      return res.redirect('/login?error=google-email-unverified');
    }

    const email = emailClaim.trim().toLowerCase();
    let user = await storage.getUserByGoogleSubject(subject);

    if (!user) {
      const existingUser = await storage.getUserByEmail(email);

      if (existingUser) {
        if (existingUser.status === 'inactive') {
          return res.redirect('/login?error=account-inactive');
        }

        user = await storage.updateUser(existingUser.id, {
          googleSubject: subject,
          status: 'active',
          verificationToken: null,
          firstName: existingUser.firstName || givenName,
          lastName: existingUser.lastName || familyName,
          profileImageUrl: existingUser.profileImageUrl || picture,
        });
      } else {
        if (!registrationPlan) {
          return res.redirect('/register?error=choose-plan');
        }
        if (termsVersion !== CURRENT_TERMS_VERSION || privacyVersion !== CURRENT_PRIVACY_VERSION) {
          return res.redirect('/register?error=accept-terms');
        }

        const generatedPassword = await bcrypt.hash(
          crypto.randomBytes(32).toString('hex'),
          10,
        );

        user = await storage.createUser({
          email,
          username: email,
          password: generatedPassword,
          googleSubject: subject,
          firstName: givenName,
          lastName: familyName,
          profileImageUrl: picture,
          role: 'user',
          status: 'active',
          verificationToken: null,
          resetPasswordToken: null,
          subscriptionPlan: registrationPlan,
          subscriptionStatus: 'active',
          subscriptionChangedAt: new Date(),
          termsAcceptedAt: new Date(),
          termsVersion,
          privacyVersion,
        });
      }
    }

    if (!user || user.status === 'inactive') {
      return res.redirect('/login?error=account-inactive');
    }

    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);
    res.redirect(returnTo);
  } catch (error) {
    console.error('Google authentication callback failed:', error);
    res.redirect('/login?error=google-sign-in-failed');
  }
});

router.get('/pending-email-change', getPendingEmailChange);
router.put('/profile', updateProfile);
// Registration endpoint
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validation = registrationRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Enter valid account details and agree to the current Terms of Service and Privacy Policy.',
      });
    }

    const { email, password, firstName, lastName, captchaToken, plan, termsVersion, privacyVersion } = validation.data;
    
    // Verify captcha (simplified here, would verify with service in production)
    if (!captchaToken && process.env.NODE_ENV === 'production') {
      return res.status(400).json({ message: 'Captcha verification failed' });
    }
    
    // Check if email already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create a one-time verification challenge. Only the code hash is stored.
    const { code: verificationCode, token: verificationToken } = createEmailVerificationChallenge();
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + 15);
    
    // Create user
    const user = await storage.createUser({
      email,
      username: email, // Using email as username
      password: hashedPassword,
      firstName: firstName || null,
      lastName: lastName || null,
      role: 'user',
      status: 'pending', // Require email verification
      verificationToken: verificationToken,
      resetPasswordToken: null,
      profileImageUrl: null,
      subscriptionPlan: plan,
      subscriptionStatus: 'active',
      subscriptionChangedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion,
      privacyVersion,
    });
    
    // Create verification record with createdAt date - explicitly mark as a registration
    await storage.createVerification({
      userId: user.id,
      token: verificationToken,
      type: 'email',
      newEmail: '', // Empty string for registration (not null)
      expiresAt: expirationDate,
      createdAt: new Date()
    });
    
    // Generate verification URL
    const baseUrl = getBaseUrl(req);
    
    // Import email utilities and send email
    const emailModule = await import('../utils/email-service');
    
    // Send welcome email with verification link - using the proper function
    const emailSent = await emailModule.sendEmail({
      to: email,
      subject: 'Confirm your Tickd email address',
      htmlContent: emailModule.getRegistrationEmailContent(verificationToken, baseUrl, verificationCode, email)
    });
    
    if (emailSent) {
      console.log(`Verification email sent to ${email}`);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV MODE] Email verification code for ${email}: ${verificationCode}`);
      }
      
      // Return success with development testing info if in dev mode
      if (process.env.NODE_ENV !== 'production') {
        return res.status(201).json({
          message: 'Registration successful. Please verify your email address.',
          _devInfo: {
            verificationUrl: `${baseUrl}/verify-email?token=${verificationToken}`
          }
        });
      } else {
        return res.status(201).json({
          message: 'Registration successful. Please verify your email address.'
        });
      }
    } else {
      // If email fails, still return success but log error
      console.error(`Failed to send verification email to ${email}`);
      return res.status(201).json({
        message: 'Registration successful, but we could not send a verification email. Please contact support.'
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'An error occurred during registration' });
  }
});

router.post('/verify-email-code', async (req: Request, res: Response) => {
  const validation = emailCodeRequestSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ message: 'Enter the six-digit code from your email.' });
  }

  const { email, code } = validation.data;
  const now = Date.now();

  try {
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'The code is invalid or has expired.' });
    }
    if (user.status === 'active') {
      return res.status(200).json({ message: 'Your email is already verified.' });
    }

    const verifications = await storage.getVerificationsByUser(user.id);
    const pendingVerification = verifications.find((verification) =>
      verification.type === 'email' && isEmailVerificationChallengeToken(verification.token),
    );

    if (!pendingVerification || pendingVerification.expiresAt.getTime() <= now) {
      if (pendingVerification) await storage.deleteVerification(pendingVerification.token);
      return res.status(400).json({ message: 'The code is invalid or has expired. Request a new code.' });
    }

    const attemptKey = pendingVerification.token;
    const attemptState = verificationAttempts.get(attemptKey);
    if (attemptState && attemptState.resetAt > now && attemptState.count >= MAX_VERIFICATION_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Request a new code or try again in 15 minutes.' });
    }
    if (!attemptState || attemptState.resetAt <= now) {
      verificationAttempts.set(attemptKey, { count: 0, resetAt: now + VERIFICATION_ATTEMPT_WINDOW_MS });
    }

    if (!verifyEmailVerificationCode(pendingVerification.token, code)) {
      const current = verificationAttempts.get(attemptKey)!;
      verificationAttempts.set(attemptKey, { ...current, count: current.count + 1 });
      return res.status(400).json({ message: 'That code is not correct. Check the email and try again.' });
    }

    await storage.updateUser(user.id, { status: 'active', verificationToken: null });
    await Promise.all(
      verifications
        .filter((verification) => verification.type === 'email')
        .map((verification) => storage.deleteVerification(verification.token)),
    );
    verificationAttempts.delete(attemptKey);
    return res.status(200).json({ message: 'Email verified successfully.' });
  } catch (error) {
    console.error('Email code verification error:', error);
    return res.status(500).json({ message: 'We could not verify the code. Please try again.' });
  }
});

// Email verification endpoint
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    // Get token from request
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Invalid verification token' });
    }
    
    // Find verification record
    const verification = await storage.getVerificationByToken(token);
    if (!verification || verification.type !== 'email') {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }
    
    // Check if token is expired
    if (verification.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Verification token has expired' });
    }
    
    // Get and update user
    const user = await storage.getUser(verification.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // New registrations must finish with the six-digit code. Legacy links remain valid.
    if (isEmailVerificationChallengeToken(token)) {
      return res.redirect(`/registration-success?email=${encodeURIComponent(user.email)}`);
    }
    
    // Update user status to active
    await storage.updateUser(user.id, {
      status: 'active',
      verificationToken: null
    });
    
    // Remove verification record
    await storage.deleteVerification(token);
    
    // Redirect to frontend with success message
    res.redirect(`/login?verified=true`);
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'An error occurred during email verification' });
  }
});

router.delete('/cancel-email-change', cancelEmailChange);
router.get('/verify-email-change', verifyEmailChange);
router.put('/password', updatePassword);
router.post('/avatar', updateAvatar);
router.get('/user', getCurrentUser);
router.patch('/subscription', async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const requestedPlan = req.body?.plan;
  if (!isSubscriptionPlan(requestedPlan)) {
    return res.status(400).json({ message: 'Choose a valid Tickd plan.' });
  }

  const user = await storage.getUser(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const currentPlan = isSubscriptionPlan(user.subscriptionPlan) ? user.subscriptionPlan : 'free';
  if (subscriptionPlanRank[requestedPlan] >= subscriptionPlanRank[currentPlan]) {
    return res.status(400).json({ message: 'Paid upgrades will be available when billing is connected.' });
  }

  const updatedUser = await storage.updateUser(userId, {
    subscriptionPlan: requestedPlan,
    subscriptionStatus: 'active',
    subscriptionChangedAt: new Date(),
  });

  return res.status(200).json({
    message: `Your account is now on the ${requestedPlan === 'free' ? 'Free' : 'Pro'} plan.`,
    user: serializeUser(updatedUser),
  });
});
router.post('/resend-verification', resendVerification);

export default router;
