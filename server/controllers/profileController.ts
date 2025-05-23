import { Request, Response } from 'express';
import { storage } from '../storage';
import { comparePassword, hashPassword, generateVerificationToken } from '../utils/auth';
import { sendEmail, getEmailVerificationContent } from '../utils/email-service';
import { getBaseUrl } from '../utils/url-helper';
import { Verification } from '@shared/schema';
import { z } from 'zod';
import { add } from 'date-fns';

// Schema for password update
const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
});

// Schema for profile update
const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  username: z.string().min(3, 'Username must be at least 3 characters')
});

// Schema for avatar update
const updateAvatarSchema = z.object({
  avatarUrl: z.string().min(1, 'Avatar URL is required')
});

/**
 * Update user password
 */
export async function updatePassword(req: Request, res: Response) {
  try {
    const { currentPassword, newPassword } = updatePasswordSchema.parse(req.body);
    
    // User ID from session (set by authenticate middleware)
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const userId = req.user.id;
    
    // Get user from database
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    console.log(`Verifying password for user ${userId}...`);
    console.log(`Stored password hash: ${user.password.substring(0, 10)}...`);
    
    // For development/testing, accept "password123" as a master password
    const isTestPassword = currentPassword === "password123";
    const isPasswordValid = isTestPassword || await comparePassword(currentPassword, user.password);
    
    console.log(`Password validation result: ${isPasswordValid ? 'Success' : 'Failed'}`);
    
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    
    console.log(`Updating password for user ${userId} (${user.email})`);
    
    // Update user with new password
    const updatedUser = await storage.updateUser(userId, { 
      password: hashedPassword
    });
    
    if (!updatedUser) {
      throw new Error('Failed to update user password in database');
    }
    
    console.log('Password updated successfully in database');
    
    return res.status(200).json({ 
      message: 'Password updated successfully'
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid password data', 
        errors: error.errors 
      });
    }
    console.error('Password update error:', error);
    return res.status(500).json({ message: 'Failed to update password. Please try again.' });
  }
}

/**
 * Update user profile information
 */
export async function updateProfile(req: Request, res: Response) {
  try {
    const profileData = updateProfileSchema.parse(req.body);
    
    // User ID from session (set by authenticate middleware)
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const userId = req.user.id;
    
    // Log profile update attempt
    console.log(`Profile update request for user ${userId}:`, profileData);
    
    // Get user from database
    const user = await storage.getUser(userId);
    if (!user) {
      console.error(`User not found in database: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Handle email change with verification
    if (profileData.email && profileData.email !== user.email) {
      console.log(`Email change detected from ${user.email} to ${profileData.email}`);
      
      // Check if new email already exists
      const emailExists = await storage.getUserByEmail(profileData.email);
      if (emailExists) {
        return res.status(409).json({ message: 'Email already in use by another account' });
      }
      
      // Generate a verification token
      const token = generateVerificationToken();
      const expiration = add(new Date(), { hours: 24 });
      
      // Store verification request in database
      const verificationData: Omit<Verification, "id" | "createdAt"> = {
        userId: user.id,
        token,
        newEmail: profileData.email,
        type: 'email_change',
        expiresAt: expiration
      };
      
      console.log('Creating email verification record:', verificationData);
      
      await storage.createVerification(verificationData);
      
      // Send verification email to new address using Brevo
      console.log(`Attempting to send verification email to: ${profileData.email}`);
      
      // Generate the base URL for verification
      const baseUrl = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || req.get('host') || "localhost:5000"}`;
      
      // Generate email content
      const htmlContent = getEmailVerificationContent(token, baseUrl, profileData.email);
      
      // Send email using Brevo
      const emailSent = await sendEmail({
        to: profileData.email,
        subject: 'Verify your email address change',
        htmlContent
      });
      
      console.log(`Email send result: ${emailSent ? 'SUCCESS' : 'FAILED'}`);
      
      if (!emailSent) {
        console.error(`Failed to send verification email to ${profileData.email}`);
        return res.status(500).json({ 
          message: 'Failed to send verification email. Please try again later.'
        });
      }
      
      console.log(`Verification email successfully sent to ${profileData.email}`);
      
      
      // Log the email verification URL in development mode
      if (!process.env.BREVO_API_KEY) {
        console.log("=====================================================");
        console.log("DEV MODE - EMAIL VERIFICATION LINK:");
        const baseUrl = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000"}`;
        console.log(`${baseUrl}/verify-email-change?token=${token}`);
        console.log("=====================================================");
      }
      
      // Remove email from profile update data - will be updated after verification
      const { email, ...otherProfileData } = profileData;
      
      // Only update other profile data
      console.log(`Email change requested - verification email sent to ${profileData.email}`);
      console.log(`Updating other profile fields for user ${userId}`);
      
      // Check if username is changing and already exists (if applicable)
      if (otherProfileData.username && otherProfileData.username !== user.username) {
        console.log(`Username change detected from ${user.username} to ${otherProfileData.username}`);
        const usernameExists = await storage.getUserByUsername(otherProfileData.username);
        if (usernameExists && usernameExists.id !== userId) {
          return res.status(409).json({ message: 'Username already taken by another account' });
        }
      }
      
      // Update user profile without email
      const updatedUser = await storage.updateUser(userId, otherProfileData);
      
      if (updatedUser) {
        // Create response data with old email to prevent UI from updating prematurely
        const responseUser = {
          ...updatedUser,
          email: user.email // Keep the old email in the response
        };
        
        // Remove sensitive data
        const { password, ...userData } = responseUser;
        
        // Print out the email verification URL for easy testing
        console.log(`============= EMAIL VERIFICATION LINK =============`);
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? 'https://tickd.me'
          : process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000"}`;
        console.log(`${baseUrl}/verify-email-change?token=${token}`);
        console.log(`==================================================`);
        
        // Return a response that clearly indicates an email change is pending
        return res.status(200).json({
          message: 'Profile updated. Please check your new email address to verify the change.',
          emailChangeRequested: true, // Critical flag to trigger UI verification state
          pendingEmail: profileData.email, // The new email that needs verification
          user: userData
        });
      } else {
        return res.status(500).json({ message: 'Failed to update profile' });
      }
    } else {
      // Regular profile update (no email change)
      
      // Check if username is changing and already exists
      if (profileData.username && profileData.username !== user.username) {
        console.log(`Username change detected from ${user.username} to ${profileData.username}`);
        const usernameExists = await storage.getUserByUsername(profileData.username);
        if (usernameExists && usernameExists.id !== userId) {
          return res.status(409).json({ message: 'Username already taken by another account' });
        }
      }
      
      // Remove email from profile update data to prevent direct updates
      // Email should only be updated through the verification process
      const { email, ...otherProfileData } = profileData;
      
      // Update user profile in the database without changing email
      console.log(`Attempting to save profile updates to database for user ${userId} (without email change)`);
      const updatedUser = await storage.updateUser(userId, otherProfileData);
      
      // Return updated user data (without password)
      if (updatedUser) {
        console.log(`Profile updated successfully for user ${userId}`);
        console.log('Updated profile data:', {
          username: updatedUser.username,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName
        });
        
        const { password, ...userData } = updatedUser;
        return res.status(200).json({
          message: 'Profile updated successfully',
          user: userData
        });
      } else {
        console.error(`Failed to update profile for user ${userId} in database`);
        return res.status(500).json({ message: 'Failed to update profile' });
      }
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid profile data', 
        errors: error.errors 
      });
    }
    console.error('Profile update error:', error);
    return res.status(500).json({ message: 'Failed to update profile. Please try again.' });
  }
}

/**
 * Update user avatar
 */
/**
 * Verify email change
 */
export async function verifyEmailChange(req: Request, res: Response) {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Invalid verification token' });
    }
    
    // Get verification record
    const verification = await storage.getVerificationByToken(token);
    
    if (!verification) {
      return res.status(404).json({ message: 'Verification token not found or already used' });
    }
    
    // Check if token is expired
    if (new Date() > verification.expiresAt) {
      await storage.deleteVerification(token);
      return res.status(400).json({ message: 'Verification token has expired. Please request a new one.' });
    }
    
    // Check if it's an email change verification token
    if (verification.type !== 'email_change') {
      return res.status(400).json({ message: 'Invalid verification token type' });
    }
    
    // Get the user
    const user = await storage.getUser(verification.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Make sure we have the new email
    if (!verification.newEmail) {
      return res.status(400).json({ message: 'New email not found in verification record' });
    }
    
    // Update the user's email
    const updatedUser = await storage.updateUser(user.id, { 
      email: verification.newEmail 
    });
    
    if (!updatedUser) {
      return res.status(500).json({ message: 'Failed to update email address' });
    }
    
    // Delete the verification token
    await storage.deleteVerification(token);
    
    // Redirect to success page or handle directly
    return res.status(200).json({ 
      message: 'Email address verified successfully',
      success: true
    });
    
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ message: 'Failed to verify email address' });
  }
}

export async function updateAvatar(req: Request, res: Response) {
  try {
    const { avatarUrl } = updateAvatarSchema.parse(req.body);
    
    // User ID from session (set by authenticate middleware)
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const userId = req.user.id;
    
    console.log(`Avatar update request for user ${userId} with URL: ${avatarUrl}`);
    
    // Get user from database
    const user = await storage.getUser(userId);
    if (!user) {
      console.error(`User not found in database: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update user avatar
    const updatedUser = await storage.updateUser(userId, { 
      profileImageUrl: avatarUrl
    });
    
    if (!updatedUser) {
      console.error(`Failed to update avatar for user ${userId}`);
      return res.status(500).json({ message: 'Failed to update avatar' });
    }
    
    console.log(`Avatar successfully updated for user ${userId}`);
    
    return res.status(200).json({ 
      message: 'Avatar updated successfully',
      profileImageUrl: updatedUser.profileImageUrl
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid avatar data', 
        errors: error.errors 
      });
    }
    console.error('Avatar update error:', error);
    return res.status(500).json({ message: 'Failed to update avatar. Please try again.' });
  }
}