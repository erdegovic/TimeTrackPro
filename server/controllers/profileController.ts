import { Request, Response } from 'express';
import { storage } from '../storage';
import { comparePassword, hashPassword } from '../utils/auth';
import { z } from 'zod';

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
    const isPasswordValid = await comparePassword(currentPassword, user.password);
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
    
    // Check if email is changing and already exists
    if (profileData.email !== user.email) {
      console.log(`Email change detected from ${user.email} to ${profileData.email}`);
      const emailExists = await storage.getUserByEmail(profileData.email);
      if (emailExists && emailExists.id !== userId) {
        return res.status(409).json({ message: 'Email already in use by another account' });
      }
    }
    
    // Check if username is changing and already exists
    if (profileData.username !== user.username) {
      console.log(`Username change detected from ${user.username} to ${profileData.username}`);
      const usernameExists = await storage.getUserByUsername(profileData.username);
      if (usernameExists && usernameExists.id !== userId) {
        return res.status(409).json({ message: 'Username already taken by another account' });
      }
    }
    
    // Update user profile in the database
    console.log(`Attempting to save profile updates to database for user ${userId}`);
    const updatedUser = await storage.updateUser(userId, profileData);
    
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