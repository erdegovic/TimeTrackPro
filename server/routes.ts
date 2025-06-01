import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertClientSchema, 
  insertProjectSchema, 
  insertTimeEntrySchema, 
  insertTimeEntryNoteSchema,
  insertInvoiceSchema, 
  insertSettingsSchema,
  timeFormatEnum,
  roundingTypeEnum,
  timeEntryUpdateSchema
} from "@shared/schema";
import { z } from "zod";
import { format, addDays } from "date-fns";
import { db } from "./db";
import { eq } from "drizzle-orm";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import verifyRoutes from "./routes/verify";
import { authenticate, handleVerificationRedirect } from "./middleware/auth";
import fetch from "node-fetch";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register auth routes
  app.use('/api/auth', authRoutes);
  
  // Register profile routes (password, profile, and avatar updates)
  app.use('/api/auth', profileRoutes);
  
  // Register email verification routes (no authentication required)
  app.use('/api/auth', verifyRoutes);
  
  // Add direct resend verification endpoint
  app.post('/api/auth/resend-verification', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: 'Email is required' });
      }
      
      console.log(`Resend verification request for email: ${email}`);
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      // Don't reveal if user exists for security
      if (!user) {
        console.log(`User not found for email: ${email}`);
        return res.status(200).json({ 
          message: 'If your account exists, a verification email has been sent.' 
        });
      }
      
      // Check if user already verified
      if (user.status === 'active') {
        console.log(`User already verified: ${email}`);
        return res.status(200).json({ 
          message: 'Your account is already verified. Please log in.' 
        });
      }
      
      // Generate a new verification token
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1); // Token expires in 24 hours
      
      // Update user's verification token
      await storage.updateUser(user.id, {
        verificationToken: token
      });
      
      // Create verification record
      await storage.createVerification({
        userId: user.id,
        token,
        type: 'email',
        newEmail: '',
        expiresAt,
        createdAt: new Date()
      });
      
      // Construct the base URL for the verification link
      let baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://tickd.me' 
        : `${req.protocol}://${req.get('host')}`;
      
      // Import email utilities
      const emailModule = await import('./utils/email-service');
      
      // Generate email content with verification link
      const emailContent = emailModule.getRegistrationEmailContent(token, baseUrl);
      
      // Send verification email
      const emailSent = await emailModule.sendEmail({
        to: email,
        subject: 'Verify Your Email Address - Tickd',
        htmlContent: emailContent
      });
      
      if (emailSent) {
        console.log(`Verification email resent to ${email}`);
        
        // For development, log the verification URL
        if (process.env.NODE_ENV === 'development') {
          console.log('[DEV MODE] Email verification link:', `${baseUrl}/verify-email?token=${token}`);
        }
        
        return res.status(200).json({ 
          message: 'Verification email has been sent. Please check your inbox.' 
        });
      } else {
        console.error(`Failed to send verification email to ${email}`);
        return res.status(500).json({ 
          message: 'Failed to send verification email. Please try again later.' 
        });
      }
    } catch (error) {
      console.error('Error resending verification email:', error);
      return res.status(500).json({ 
        message: 'An unexpected error occurred. Please try again.' 
      });
    }
  });
  
  // Simplified email verification redirect - direct visitors to API endpoint
  app.get('/verify-email-change', handleVerificationRedirect);
  app.get('/verify-email', handleVerificationRedirect);
  
  // API endpoint to verify email token
  app.get('/api/auth/verify-email', async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        // Redirect to login with error message
        return res.redirect('/login?error=missing-token');
      }
      
      console.log('Processing verification token:', token);
      
      // Find verification record
      const verification = await storage.getVerificationByToken(token);
      
      if (!verification) {
        console.log('Verification token not found in database:', token);
        // Redirect to login with error message
        return res.redirect('/login?error=invalid-token');
      }
      
      console.log('Verification record found:', verification);
      
      // Find user
      const user = await storage.getUser(verification.userId);
      
      if (!user) {
        console.log('User not found for verification:', verification.userId);
        // Redirect to login with error message
        return res.redirect('/login?error=user-not-found');
      }
      
      console.log('Found user for verification:', user.id);
      
      // Update user status
      await storage.updateUser(user.id, { 
        status: 'active',
        verificationToken: null
      });
      
      console.log('User status updated to active');
      
      // Remove verification token
      await storage.deleteVerification(token);
      
      console.log('Verification token deleted');
      
      // Redirect to login with success message
      return res.redirect('/login?verified=true');
    } catch (error) {
      console.error('Email verification error:', error);
      // Redirect to login with error message
      return res.redirect('/login?error=verification-failed');
    }
  });
  
  // Login endpoint
  app.post('/api/login', async (req: Request, res: Response) => {
    try {
      const { email, password, rememberMe } = req.body;
      
      console.log(`Login attempt with email: ${email}`);
      
      // Find user by email
      const foundUser = await storage.getUserByEmail(email);
      
      // For development, accept test credentials
      const isTestCredential = email === 'test@example.com' && password === 'password123';
      
      if (foundUser || isTestCredential) {
        // Check if email is verified (except for test account)
        if (foundUser && foundUser.status === 'pending' && !isTestCredential) {
          console.log(`Login rejected - unverified email: ${email}`);
          return res.status(403).json({ 
            message: 'Please verify your email address before logging in',
            needsVerification: true,
            email: email
          });
        }
        
        // Set session data
        if (!req.session) {
          req.session = {} as any;
        }
        
        // Configure session duration based on "Remember Me"
        if (rememberMe) {
          // Remember me: 30 days
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
          console.log(`Login with Remember Me enabled - session extended to 30 days`);
        } else {
          // Normal session: 24 hours
          req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
          console.log(`Login without Remember Me - session set to 24 hours`);
        }
        
        // Set up user session
        if (foundUser) {
          req.session.userId = foundUser.id;
          
          return res.status(200).json({
            message: "Login successful",
            user: foundUser
          });
        } else {
          // Use test user if no real user found
          req.session.userId = 1;
          
          return res.status(200).json({
            message: "Login successful",
            user: {
              id: 1,
              username: "testuser",
              firstName: "Attila", 
              lastName: "Erdeg",
              email: "test@example.com"
            }
          });
        }
      }
      
      return res.status(401).json({ message: "Invalid email or password" });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ message: 'An error occurred during login' });
    }
  });
  
  // Handle frontend verification route - serve the SPA
  app.get('/verify-email', (req: Request, res: Response, next: NextFunction) => {
    // If this is an API call, pass it to the next handler
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    // Otherwise serve the SPA - let the React app handle verification
    return next();
  });
  
  // All API routes use /api prefix
  
  // Clients API
  app.get("/api/clients", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Get clients directly filtered by user ID from database
      const userClients = await storage.getClientsByUser(userId);
      
      res.json(userClients);
    } catch (error) {
      console.error('Error getting clients:', error);
      res.status(500).json({ message: 'Failed to fetch clients' });
    }
  });
  
  app.get("/api/clients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
      res.json(client);
    } catch (error) {
      console.error('Error getting client:', error);
      res.status(500).json({ message: 'Failed to fetch client' });
    }
  });
  
  app.post("/api/clients", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const data = insertClientSchema.parse(req.body);
      const clientWithUser = { ...data, userId };
      const client = await storage.createClient(clientWithUser);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid client data', 
          errors: error.errors 
        });
      }
      console.error('Error creating client:', error);
      res.status(500).json({ message: 'Failed to create client' });
    }
  });
  
  app.put("/api/clients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertClientSchema.parse(req.body);
      const client = await storage.updateClient(id, data);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid client data', 
          errors: error.errors 
        });
      }
      console.error('Error updating client:', error);
      res.status(500).json({ message: 'Failed to update client' });
    }
  });
  
  app.delete("/api/clients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteClient(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Client not found' });
      }
      res.json({ message: 'Client deleted successfully' });
    } catch (error) {
      console.error('Error deleting client:', error);
      res.status(500).json({ message: 'Failed to delete client' });
    }
  });
  
  // Projects API
  app.get("/api/projects", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Get projects directly filtered by user ID from database
      const userProjects = await storage.getProjectsByUser(userId);
      
      res.json(userProjects);
    } catch (error) {
      console.error('Error getting projects:', error);
      res.status(500).json({ message: 'Failed to fetch projects' });
    }
  });
  
  app.get("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(project);
    } catch (error) {
      console.error('Error getting project:', error);
      res.status(500).json({ message: 'Failed to fetch project' });
    }
  });
  
  app.post("/api/projects", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const data = insertProjectSchema.parse(req.body);
      const projectWithUser = { ...data, userId };
      const project = await storage.createProject(projectWithUser);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid project data', 
          errors: error.errors 
        });
      }
      console.error('Error creating project:', error);
      res.status(500).json({ message: 'Failed to create project' });
    }
  });
  
  app.put("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertProjectSchema.parse(req.body);
      const project = await storage.updateProject(id, data);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid project data', 
          errors: error.errors 
        });
      }
      console.error('Error updating project:', error);
      res.status(500).json({ message: 'Failed to update project' });
    }
  });
  
  app.delete("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProject(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json({ message: 'Project deleted successfully' });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ message: 'Failed to delete project' });
    }
  });
  
  // Time Entries API
  app.get("/api/time-entries", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Get time entries with project and client data
      console.log(`Fetching time entries for user ${userId}`);
      const timeEntries = await storage.getTimeEntriesByUser(userId);
      console.log(`Found ${timeEntries.length} time entries for user ${userId}`);
      const projects = await storage.getProjectsByUser(userId);
      const clients = await storage.getClientsByUser(userId);
      
      // Enrich time entries with project and client data including colors
      const enrichedEntries = timeEntries.map(entry => {
        const project = projects.find(p => p.id === entry.projectId);
        const client = project ? clients.find(c => c.id === project.clientId) : null;
        
        return {
          ...entry,
          project: project || null,
          client: client || null
        };
      });
      
      console.log(`Returning ${enrichedEntries.length} enriched entries`);
      res.json(enrichedEntries);
    } catch (error) {
      console.error('Error getting time entries:', error);
      res.status(500).json({ message: 'Failed to fetch time entries' });
    }
  });
  
  app.get("/api/time-entries/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const timeEntry = await storage.getTimeEntry(id);
      
      if (!timeEntry) {
        return res.status(404).json({ message: 'Time entry not found' });
      }
      
      // Check if time entry belongs to the authenticated user
      if (timeEntry.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Verify that the entry belongs to the current user
      if (timeEntry.userId && timeEntry.userId !== req.user?.id && process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ message: 'Unauthorized access to this time entry' });
      }
      
      res.json(timeEntry);
    } catch (error) {
      console.error('Error getting time entry:', error);
      res.status(500).json({ message: 'Failed to fetch time entry' });
    }
  });
  
  app.post("/api/time-entries", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Parse and validate the data
      const data = insertTimeEntrySchema.parse(req.body);
      
      // Add the current user's ID to the time entry
      const timeEntryWithUser = {
        ...data,
        userId: userId
      };
      
      // Create the time entry in storage
      const timeEntry = await storage.createTimeEntry(timeEntryWithUser);
      res.status(201).json(timeEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid time entry data', 
          errors: error.errors 
        });
      }
      console.error('Error creating time entry:', error);
      res.status(500).json({ message: 'Failed to create time entry' });
    }
  });
  
  // Special endpoint for saving time tracker entries
  app.post("/api/tracker/time-entries", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Convert timestamp strings to Date objects and ensure date field is set
      const startTime = req.body.startTime ? new Date(req.body.startTime) : new Date();
      
      // Allow projectId to be null for entries without projects
      
      const data = {
        ...req.body,
        userId: userId,
        startTime: startTime,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
        date: startTime.toISOString().split('T')[0], // Add date field in YYYY-MM-DD format
      };
      
      console.log('Tracker time entry data being sent to database:', data);
      
      const timeEntry = await storage.createTimeEntry(data as any);
      res.status(201).json(timeEntry);
    } catch (error) {
      console.error('Error creating tracker time entry:', error);
      res.status(500).json({ message: 'Failed to create time entry from tracker' });
    }
  });
  
  app.put("/api/time-entries/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // First verify the user owns this time entry
      const existingEntry = await storage.getTimeEntry(id);
      if (!existingEntry) {
        return res.status(404).json({ message: 'Time entry not found' });
      }
      
      // Check if entry belongs to current user
      if (existingEntry.userId !== userId) {
        return res.status(403).json({ message: 'You are not authorized to update this time entry' });
      }
      
      // Parse and update the entry
      const data = timeEntryUpdateSchema.parse(req.body);
      console.log('Updating time entry with data:', JSON.stringify(data, null, 2));
      const timeEntry = await storage.updateTimeEntry(id, data);
      console.log('Updated time entry result:', JSON.stringify(timeEntry, null, 2));
      
      res.json(timeEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid time entry data', 
          errors: error.errors 
        });
      }
      console.error('Error updating time entry:', error);
      res.status(500).json({ message: 'Failed to update time entry' });
    }
  });
  
  app.delete("/api/time-entries/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // First verify the user owns this time entry
      const existingEntry = await storage.getTimeEntry(id);
      if (!existingEntry) {
        return res.status(404).json({ message: 'Time entry not found' });
      }
      
      // Check if entry belongs to current user
      if (existingEntry.userId !== userId) {
        return res.status(403).json({ message: 'You are not authorized to delete this time entry' });
      }
      
      // Delete the entry
      const deleted = await storage.deleteTimeEntry(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Time entry not found' });
      }
      
      res.json({ message: 'Time entry deleted successfully' });
    } catch (error) {
      console.error('Error deleting time entry:', error);
      res.status(500).json({ message: 'Failed to delete time entry' });
    }
  });
  
  // Reports API
  app.post("/api/reports", authenticate, async (req: Request, res: Response) => {
    try {
      const { clientId, projectId, startDate, endDate, timeFormat, roundingType, timeAdjustment } = req.body;
      
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      console.log(`[Reports] Generating report for user ${userId} with filters:`, {
        clientId, projectId, startDate, endDate, timeFormat, roundingType, timeAdjustment
      });
      
      // Create filters object including userId
      const filters = {
        userId,
        clientId: clientId ? parseInt(clientId) : undefined,
        projectId: projectId ? parseInt(projectId) : undefined,
        startDate,
        endDate,
        timeFormat: timeFormat as "decimal" | "time",
        roundingType: roundingType as "none" | "nearest_tenth" | "nearest_quarter" | "nearest_half",
        timeAdjustment,
        excludeInvoiced: false // Include all entries, not just non-invoiced ones
      };
      
      const entries = await storage.getTimeEntriesByFilters(filters);
      
      console.log(`[Reports] Found ${entries.length} entries for user ${userId}`);
      
      // Get all projects and clients for enrichment
      const projects = await storage.getProjectsByUser(userId);
      const clients = await storage.getClientsByUser(userId);
      const settings = await storage.getSettings();
      
      // Enrich entries with client and project data, including rate calculations
      const enrichedEntries = await Promise.all(entries.map(async (entry) => {
        const project = projects.find(p => p.id === entry.projectId);
        const client = clients.find(c => c.id === project?.clientId);
        
        // Use stored duration value (which may have been manually edited)
        let durationHours = 0;
        if (entry.duration) {
          durationHours = parseFloat(entry.duration);
        } else if (entry.startTime && entry.endTime) {
          // Fallback to calculation only if no stored duration
          const start = new Date(entry.startTime);
          const end = new Date(entry.endTime);
          durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
        
        console.log(`Entry ${entry.id}: using stored duration ${durationHours} hours`);
        
        // Get hourly rate and calculate amount
        const hourlyRateValue = parseFloat(project?.hourlyRate || "0");
        const amount = durationHours * hourlyRateValue;
        
        // Use client currency since projects don't have currency field
        const projectCurrency = client?.currency || 'USD';
        
        console.log(`Entry ${entry.id}: ${durationHours}h × ${hourlyRateValue} ${projectCurrency} = ${amount} ${projectCurrency}`);
        
        // Keep amounts in their original currency to avoid confusion
        const convertedAmount = amount;
        
        return {
          ...entry,
          client,
          project,
          hourlyRate: project?.hourlyRate || "0",
          amount: convertedAmount.toFixed(2),
          duration: durationHours.toFixed(2)
        };
      }));
      
      // Group entries based on settings
      let groupedData: any = {};
      
      if (settings?.enableWeeklyCategorization) {
        // Group by weeks within month and merge same project/client/description
        groupedData = enrichedEntries.reduce((acc: any, entry) => {
          const entryDate = new Date(entry.date);
          const year = entryDate.getFullYear();
          const month = entryDate.getMonth();
          const startOfMonth = new Date(year, month, 1);
          const dayOfMonth = entryDate.getDate();
          const weekOfMonth = Math.ceil(dayOfMonth / 7);
          
          const weekKey = `${year}-${month + 1}-W${weekOfMonth}`;
          const monthName = entryDate.toLocaleString('default', { month: 'long' });
          const weekLabel = `Week ${weekOfMonth} of ${monthName} ${year}`;
          
          if (!acc[weekKey]) {
            acc[weekKey] = {
              weekNumber: weekOfMonth,
              weekLabel,
              totalHours: 0,
              totalAmount: 0,
              entries: [],
              groupedEntries: {}
            };
          }
          
          // Create a grouping key for merging entries
          const groupKey = `${entry.projectId}-${entry.client?.id}-${entry.description}`;
          
          if (!acc[weekKey].groupedEntries[groupKey]) {
            acc[weekKey].groupedEntries[groupKey] = {
              ...entry,
              duration: 0,
              amount: 0,
              mergedCount: 0
            };
          }
          
          // Merge the entry
          acc[weekKey].groupedEntries[groupKey].duration += parseFloat(entry.duration);
          acc[weekKey].groupedEntries[groupKey].amount += parseFloat(entry.amount);
          acc[weekKey].groupedEntries[groupKey].mergedCount += 1;
          
          acc[weekKey].totalHours += parseFloat(entry.duration);
          acc[weekKey].totalAmount += parseFloat(entry.amount);
          
          return acc;
        }, {});
        
        // Convert grouped entries back to arrays
        Object.keys(groupedData).forEach(weekKey => {
          groupedData[weekKey].entries = Object.values(groupedData[weekKey].groupedEntries).map((entry: any) => ({
            ...entry,
            duration: entry.duration.toFixed(6),
            amount: entry.amount.toFixed(2)
          }));
          delete groupedData[weekKey].groupedEntries;
        });
      } else {
        // Group everything into a single period and merge same project/client/description
        const groupedEntries = enrichedEntries.reduce((acc: any, entry) => {
          const groupKey = `${entry.projectId}-${entry.client?.id}-${entry.description}`;
          
          if (!acc[groupKey]) {
            acc[groupKey] = {
              ...entry,
              duration: 0,
              amount: 0,
              mergedCount: 0
            };
          }
          
          acc[groupKey].duration += parseFloat(entry.duration);
          acc[groupKey].amount += parseFloat(entry.amount);
          acc[groupKey].mergedCount += 1;
          
          return acc;
        }, {});
        
        const totalHours = enrichedEntries.reduce((sum, entry) => sum + parseFloat(entry.duration), 0);
        const totalAmount = enrichedEntries.reduce((sum, entry) => sum + parseFloat(entry.amount), 0);
        
        groupedData = {
          'single-period': {
            weekNumber: 1,
            weekLabel: 'Selected Period',
            totalHours,
            totalAmount,
            entries: Object.values(groupedEntries).map((entry: any) => ({
              ...entry,
              duration: entry.duration.toFixed(6),
              amount: entry.amount.toFixed(2)
            }))
          }
        };
      }
      
      const weeklyData = Object.values(groupedData);
      
      // Calculate totals from the grouped data
      const totalHours = weeklyData.reduce((sum: number, week: any) => sum + week.totalHours, 0);
      const totalAmount = weeklyData.reduce((sum: number, week: any) => sum + week.totalAmount, 0);
      
      console.log(`[Reports] Returning report data with ${enrichedEntries.length} entries, ${weeklyData.length} groups, total: $${totalAmount.toFixed(2)}`);
      
      return res.json({
        timeEntries: enrichedEntries,
        weeklyData,
        totalHours,
        totalAmount,
        timeFormat: filters.timeFormat,
        roundingType: filters.roundingType
      });
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({ message: 'Failed to generate report' });
    }
  });
  
  // Time Entry Notes API
  app.get("/api/time-entries/:timeEntryId/notes", authenticate, async (req: Request, res: Response) => {
    try {
      const timeEntryId = parseInt(req.params.timeEntryId);
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Verify the time entry belongs to the user
      const timeEntry = await storage.getTimeEntry(timeEntryId);
      if (!timeEntry || timeEntry.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const notes = await storage.getTimeEntryNotes(timeEntryId);
      res.json(notes);
    } catch (error) {
      console.error('Error getting time entry notes:', error);
      res.status(500).json({ message: 'Failed to fetch notes' });
    }
  });
  
  app.get("/api/time-entry-notes", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const notes = await storage.getAllTimeEntryNotes(userId);
      res.json(notes);
    } catch (error) {
      console.error('Error getting all time entry notes:', error);
      res.status(500).json({ message: 'Failed to fetch notes' });
    }
  });
  
  app.post("/api/time-entries/:timeEntryId/notes", authenticate, async (req: Request, res: Response) => {
    try {
      const timeEntryId = parseInt(req.params.timeEntryId);
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Verify the time entry belongs to the user
      const timeEntry = await storage.getTimeEntry(timeEntryId);
      if (!timeEntry || timeEntry.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const noteData = insertTimeEntryNoteSchema.parse({
        timeEntryId,
        content: req.body.content,
        userId
      });
      
      const note = await storage.createTimeEntryNote(noteData);
      res.status(201).json(note);
    } catch (error) {
      console.error('Error creating time entry note:', error);
      res.status(500).json({ message: 'Failed to create note' });
    }
  });
  
  app.put("/api/time-entry-notes/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.id);
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // First get all user notes to verify ownership
      const userNotes = await storage.getAllTimeEntryNotes(userId);
      const noteExists = userNotes.some(note => note.id === noteId);
      
      if (!noteExists) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const noteData = {
        content: req.body.content
      };
      
      const updatedNote = await storage.updateTimeEntryNote(noteId, noteData);
      
      if (!updatedNote) {
        return res.status(404).json({ message: 'Note not found' });
      }
      
      res.json(updatedNote);
    } catch (error) {
      console.error('Error updating time entry note:', error);
      res.status(500).json({ message: 'Failed to update note' });
    }
  });
  
  app.delete("/api/time-entry-notes/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.id);
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // First get all user notes to verify ownership
      const userNotes = await storage.getAllTimeEntryNotes(userId);
      const noteExists = userNotes.some(note => note.id === noteId);
      
      if (!noteExists) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const deleted = await storage.deleteTimeEntryNote(noteId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Note not found' });
      }
      
      res.json({ message: 'Note deleted successfully' });
    } catch (error) {
      console.error('Error deleting time entry note:', error);
      res.status(500).json({ message: 'Failed to delete note' });
    }
  });
  
  // Invoices API
  app.get("/api/invoices", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Get all invoices and filter by user ID
      const allInvoices = await storage.getInvoices();
      const userInvoices = allInvoices.filter(invoice => invoice.userId === userId);
      
      res.json(userInvoices);
    } catch (error) {
      console.error('Error getting invoices:', error);
      res.status(500).json({ message: 'Failed to fetch invoices' });
    }
  });
  
  app.get("/api/invoices/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const invoice = await storage.getInvoice(id);
      
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      
      // Check if invoice belongs to current user (skip this check in development)
      if (invoice.userId && 
          invoice.userId !== req.user?.id && 
          process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ message: 'You are not authorized to view this invoice' });
      }
      
      res.json(invoice);
    } catch (error) {
      console.error('Error getting invoice:', error);
      res.status(500).json({ message: 'Failed to fetch invoice' });
    }
  });
  
  app.get("/api/invoices/number/:number", authenticate, async (req: Request, res: Response) => {
    try {
      const invoiceNumber = req.params.number;
      const invoice = await storage.getInvoiceByNumber(invoiceNumber);
      
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      
      // In development mode, allow access to all invoices
      // In production, check if the invoice belongs to the current user
      if (process.env.NODE_ENV !== 'development' && invoice.userId && invoice.userId !== req.user?.id) {
        return res.status(403).json({ message: 'You are not authorized to view this invoice' });
      }
      
      res.json(invoice);
    } catch (error) {
      console.error('Error getting invoice by number:', error);
      res.status(500).json({ message: 'Failed to fetch invoice' });
    }
  });
  
  app.post("/api/invoices", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Parse the invoice data
      const data = insertInvoiceSchema.parse(req.body);
      
      // Add the user ID to the invoice data
      const invoiceWithUser = {
        ...data,
        userId: userId
      };
      
      // Create the invoice in storage
      const invoice = await storage.createInvoice(invoiceWithUser);
      res.status(201).json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid invoice data', 
          errors: error.errors 
        });
      }
      console.error('Error creating invoice:', error);
      res.status(500).json({ message: 'Failed to create invoice' });
    }
  });
  
  app.put("/api/invoices/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // First verify the user owns this invoice
      const existingInvoice = await storage.getInvoice(id);
      if (!existingInvoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      
      // Check if invoice belongs to current user (unless in development)
      if (existingInvoice.userId && 
          existingInvoice.userId !== req.user?.id && 
          process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ message: 'You are not authorized to update this invoice' });
      }
      
      const data = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.updateInvoice(id, data);
      
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      
      res.json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid invoice data', 
          errors: error.errors 
        });
      }
      console.error('Error updating invoice:', error);
      res.status(500).json({ message: 'Failed to update invoice' });
    }
  });
  
  app.delete("/api/invoices/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // First verify the user owns this invoice
      const existingInvoice = await storage.getInvoice(id);
      if (!existingInvoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      
      // Check if invoice belongs to current user (unless in development)
      if (existingInvoice.userId && 
          existingInvoice.userId !== req.user?.id && 
          process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ message: 'You are not authorized to delete this invoice' });
      }
      
      // Delete the invoice
      const deleted = await storage.deleteInvoice(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      
      res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
      console.error('Error deleting invoice:', error);
      res.status(500).json({ message: 'Failed to delete invoice' });
    }
  });
  
  app.get("/api/next-invoice-number", async (req: Request, res: Response) => {
    try {
      const invoiceNumber = await storage.getNextInvoiceNumber();
      res.json({ invoiceNumber });
    } catch (error) {
      console.error('Error getting next invoice number:', error);
      res.status(500).json({ message: 'Failed to get next invoice number' });
    }
  });
  
  // Settings API
  app.get("/api/settings", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error getting settings:', error);
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  });
  
  app.put("/api/settings", async (req: Request, res: Response) => {
    try {
      const data = insertSettingsSchema.parse(req.body);
      const settings = await storage.updateSettings(data);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid settings data', 
          errors: error.errors 
        });
      }
      console.error('Error updating settings:', error);
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });

  // Creativity Notes Routes
  app.get("/api/creativity/notes", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId || req.user?.id || 1;
      const notes = await storage.getCreativityNotes(userId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/creativity/notes", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId || req.user?.id || 1;
      const noteData = { ...req.body, userId };
      const note = await storage.createCreativityNote(noteData);
      res.json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.put("/api/creativity/notes/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.id);
      const note = await storage.updateCreativityNote(noteId, req.body);
      res.json(note);
    } catch (error) {
      console.error("Error updating note:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  app.delete("/api/creativity/notes/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.id);
      await storage.deleteCreativityNote(noteId);
      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  // Weekly Goals Routes
  app.get("/api/creativity/goals", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId || req.user?.id || 1;
      const goals = await storage.getWeeklyGoals(userId);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post("/api/creativity/goals", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId || req.user?.id || 1;
      const goalData = { ...req.body, userId };
      const goal = await storage.createWeeklyGoal(goalData);
      res.json(goal);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(500).json({ message: "Failed to create goal" });
    }
  });

  app.put("/api/creativity/goals/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const goalId = parseInt(req.params.id);
      const goal = await storage.updateWeeklyGoal(goalId, req.body);
      res.json(goal);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  app.delete("/api/creativity/goals/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const goalId = parseInt(req.params.id);
      await storage.deleteWeeklyGoal(goalId);
      res.json({ message: "Goal deleted successfully" });
    } catch (error) {
      console.error("Error deleting goal:", error);
      res.status(500).json({ message: "Failed to delete goal" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}