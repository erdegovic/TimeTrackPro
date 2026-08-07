import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import fs from "fs";
import path from "path";
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
  timeEntryUpdateSchema,
  clients as clientsTable,
  projects as projectsTable,
  invoices as invoicesTable,
  timeEntryNotes as timeEntryNotesTable,
  creativityNotes as creativityNotesTable,
  weeklyGoals as weeklyGoalsTable,
  timeEntries as timeEntriesTable,
  users as usersTable,
} from "@shared/schema";
import { z } from "zod";
import { format, addDays, differenceInCalendarWeeks, startOfWeek } from "date-fns";
import { db } from "./db";
import { and, eq, inArray, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import authRoutes from "./routes/auth";
import { authenticate } from "./middleware/auth";
import fetch from "node-fetch";
import { getLiveExchangeRates } from "./exchange-rates";
import {
  createAccountSnapshot,
  getAccountBackupState,
  getBackupSystemSummary,
  getLatestAccountSnapshot,
  restoreAccountSnapshot,
  runAccountBackupCycle,
} from "./backups/account-snapshots";
import { sendContactMessage } from "./utils/email-service";
import { getAdminGrantedSubscriptionStatus, getInvoiceCapabilities } from "@shared/subscriptions";
import paddleBillingRoutes from "./billing/paddle";
import ultimateRoutes from "./ultimate/routes";
import { establishAuthenticatedSession, revokeUserSessions } from "./session-store";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "./security";
import { recordAdminAuditEvent } from "./admin-audit";
import { validateProfileImageDataUrl } from "./utils/profile-image";

const parseInvoiceSettings = (raw?: string | null) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const musicPlaylists = [
  {
    id: "deep-work",
    name: "Deep Work",
    description: "Slow ambient layers for long editing, invoicing, and writing sessions.",
    intent: "Focus",
    accent: "blue",
    folder: "deep-work",
  },
  {
    id: "creative-flow",
    name: "Creative Flow",
    description: "Warm rhythmic beds for concepting, arranging, and design passes.",
    intent: "Create",
    accent: "emerald",
    folder: "creative-flow",
  },
  {
    id: "reset",
    name: "Reset",
    description: "Gentle textures for between-client breaks and end-of-day decompression.",
    intent: "Recover",
    accent: "violet",
    folder: "reset",
  },
];

const audioExtensions = new Set([".mp3", ".m4a", ".wav", ".ogg", ".flac"]);
const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

const titleFromFilename = (filename: string) => {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const encodePublicPath = (...segments: string[]) => {
  return `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
};

const getMusicRoot = () => {
  const candidates = [
    path.resolve(process.cwd(), "client", "public", "music"),
    path.resolve(import.meta.dirname, "..", "client", "public", "music"),
    path.resolve(import.meta.dirname, "public", "music"),
    path.resolve(process.cwd(), "server", "public", "music"),
    path.resolve(process.cwd(), "dist", "public", "music"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
};

export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/api/ultimate", ultimateRoutes);
  const contactRequestSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(255),
    subject: z.string().trim().min(3).max(140),
    message: z.string().trim().min(10).max(5000),
    website: z.string().max(0).optional(),
  });

  app.post('/api/contact', async (req: Request, res: Response) => {
    const validation = contactRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Complete every field with a valid email and message.' });
    }

    const sent = await sendContactMessage(validation.data);
    if (!sent) {
      return res.status(503).json({ message: 'Your message could not be sent right now. Please try again shortly.' });
    }

    return res.status(200).json({ message: 'Thanks. Your message is on its way to Tickd support.' });
  });

  const parseLocalDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const getCalendarWeekOfMonth = (dateString: string) => {
    const entryDate = parseLocalDate(dateString);
    const firstOfMonth = new Date(entryDate.getFullYear(), entryDate.getMonth(), 1);
    const weekNumber = differenceInCalendarWeeks(entryDate, firstOfMonth, { weekStartsOn: 1 }) + 1;
    const monthName = entryDate.toLocaleString('default', { month: 'long' });

    return {
      entryDate,
      weekNumber,
      weekKey: `${entryDate.getFullYear()}-${entryDate.getMonth() + 1}-W${weekNumber}`,
      weekLabel: `Week ${weekNumber} of ${monthName} ${entryDate.getFullYear()}`,
      weekStart: startOfWeek(entryDate, { weekStartsOn: 1 }),
    };
  };

  const getAuthenticatedUserId = (req: Request, res: Response): number | undefined => {
    const userId = req.session?.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return undefined;
    }
    return userId;
  };

  const isOwnedByUser = (recordUserId: number | null | undefined, userId: number) => {
    return recordUserId === userId;
  };

  const validateTimeEntryRelations = async (
    userId: number,
    data: { projectId?: unknown; clientId?: unknown },
  ): Promise<string | null> => {
    const parseRelationId = (value: unknown) => {
      if (value === null || value === undefined || value === "") return undefined;
      const id = Number(value);
      return Number.isInteger(id) && id > 0 ? id : NaN;
    };

    const projectId = parseRelationId(data.projectId);
    const clientId = parseRelationId(data.clientId);

    if (Number.isNaN(projectId) || Number.isNaN(clientId)) {
      return "Invalid project or client";
    }

    const [project, client] = await Promise.all([
      projectId ? storage.getProject(projectId) : Promise.resolve(undefined),
      clientId ? storage.getClient(clientId) : Promise.resolve(undefined),
    ]);

    if (projectId && (!project || !isOwnedByUser(project.userId, userId))) {
      return "The selected project is not available to this account";
    }

    if (clientId && (!client || !isOwnedByUser(client.userId, userId))) {
      return "The selected client is not available to this account";
    }

    if (project && clientId && project.clientId !== clientId) {
      return "The selected project does not belong to the selected client";
    }

    return null;
  };

  const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.session?.userId || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      req.user = { ...(req.user || {}), ...user };
      next();
    } catch (error) {
      console.error("Admin authorization error:", error);
      res.status(500).json({ message: "Failed to verify admin access" });
    }
  };

  const requireRecentAuthentication = (req: Request, res: Response, next: NextFunction) => {
    const authenticatedAt = req.session?.authenticatedAt;
    if (!authenticatedAt || Date.now() - authenticatedAt > 30 * 60 * 1000) {
      return res.status(428).json({
        code: "ADMIN_REAUTH_REQUIRED",
        message: "For security, sign out and sign back in before using recovery controls.",
      });
    }

    next();
  };

  const requireInvoicePro = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.session?.userId || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const user = await storage.getUser(userId);
      const access = getInvoiceCapabilities(user?.subscriptionPlan, user?.subscriptionStatus);
      if (!user || !access.canSave) {
        return res.status(403).json({
          code: "PRO_REQUIRED",
          message: "Upgrade to Pro to save and manage invoices.",
        });
      }

      req.user = { ...(req.user || {}), ...user };
      next();
    } catch (error) {
      console.error("Invoice subscription authorization error:", error);
      res.status(500).json({ message: "Failed to verify invoice access" });
    }
  };

  const getCountForUser = async (table: any, userId: number) => {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(table)
      .where(eq(table.userId, userId));
    return Number(result?.count || 0);
  };

  // Register auth routes
  app.use('/api/auth', authRoutes);
  
  app.use('/api/billing', paddleBillingRoutes);

  app.get('/api/music-library', async (_req: Request, res: Response) => {
    const musicRoot = getMusicRoot();

    const playlists = musicPlaylists.map((playlist) => {
      const folderPath = path.join(musicRoot, playlist.folder);
      const files = fs.existsSync(folderPath) ? fs.readdirSync(folderPath, { withFileTypes: true }) : [];
      const fileNames = files.filter((file) => file.isFile()).map((file) => file.name);

      const tracks = fileNames
        .filter((fileName) => audioExtensions.has(path.extname(fileName).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .map((fileName) => {
          const baseName = path.basename(fileName, path.extname(fileName));
          const thumbnail = imageExtensions
            .map((extension) => `${baseName}${extension}`)
            .find((candidate) => fileNames.some((name) => name.toLowerCase() === candidate.toLowerCase()));

          return {
            id: `${playlist.id}:${fileName}`,
            title: titleFromFilename(fileName),
            fileName,
            url: encodePublicPath("music", playlist.folder, fileName),
            thumbnailUrl: thumbnail ? encodePublicPath("music", playlist.folder, thumbnail) : null,
          };
        });

      return {
        ...playlist,
        tracks,
      };
    });

    res.setHeader("Cache-Control", "no-store");
    res.json({ playlists });
  });
  
  // Login endpoint
  app.post('/api/login', async (req: Request, res: Response) => {
    try {
      const validation = z.object({
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(1).max(128),
      }).safeParse(req.body);
      if (!validation.success) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const { email, password } = validation.data;
      
      // Find user by email
      const foundUser = await storage.getUserByEmail(email);
      
      if (!foundUser) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password with bcrypt
      const passwordValid = await bcrypt.compare(password, foundUser.password);
      if (!passwordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Check if email is verified
      if (foundUser.status === 'pending') {
        return res.status(403).json({ 
          message: 'Please verify your email address before logging in',
          needsVerification: true,
          email: email
        });
      }

      if (foundUser.status !== 'active') {
        return res.status(403).json({ message: 'This account is not active.' });
      }

      await establishAuthenticatedSession(req, foundUser.id, 'password');
      
      return res.status(200).json({
        message: "Login successful",
        user: {
          id: foundUser.id,
          email: foundUser.email,
          username: foundUser.username,
          firstName: foundUser.firstName,
          lastName: foundUser.lastName,
          profileImageUrl: foundUser.profileImageUrl,
          role: foundUser.role,
          status: foundUser.status,
          createdAt: foundUser.createdAt,
          updatedAt: foundUser.updatedAt,
          subscriptionPlan: foundUser.subscriptionPlan,
          subscriptionStatus: foundUser.subscriptionStatus,
          subscriptionChangedAt: foundUser.subscriptionChangedAt,
          subscriptionRequestedPlan: foundUser.subscriptionRequestedPlan,
          subscriptionCurrentPeriodEnd: foundUser.subscriptionCurrentPeriodEnd,
          subscriptionCancelAtPeriodEnd: foundUser.subscriptionCancelAtPeriodEnd,
          paddleCustomerId: foundUser.paddleCustomerId,
        }
      });
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

  // Admin recovery API - metadata only, no private project/note/invoice content
  app.get("/api/admin/summary", authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const [usersCount] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
      const [activeUsersCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(eq(usersTable.status, "active"));
      const [adminUsersCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(eq(usersTable.role, "admin"));
      const backupSummary = await getBackupSystemSummary();

      res.json({
        totalUsers: Number(usersCount?.count || 0),
        activeUsers: Number(activeUsersCount?.count || 0),
        adminUsers: Number(adminUsersCount?.count || 0),
        backupStatus: backupSummary.status,
        restoreStatus: backupSummary.restoreStatus,
        latestSnapshotAt: backupSummary.latestSnapshotAt,
        protectedUsers: backupSummary.protectedUsers,
      });
    } catch (error) {
      console.error("Error getting admin summary:", error);
      res.status(500).json({ message: "Failed to fetch admin summary" });
    }
  });

  app.get("/api/admin/users", authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const allUsers = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          username: usersTable.username,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          role: usersTable.role,
          status: usersTable.status,
          subscriptionPlan: usersTable.subscriptionPlan,
          subscriptionStatus: usersTable.subscriptionStatus,
          subscriptionChangedAt: usersTable.subscriptionChangedAt,
          createdAt: usersTable.createdAt,
          updatedAt: usersTable.updatedAt,
        })
        .from(usersTable)
        .orderBy(usersTable.id);

      const usersWithRecoveryMetadata = await Promise.all(
        allUsers.map(async (user) => {
          const backupState = await getAccountBackupState(user.id);
          const latestSnapshot = backupState.latestSnapshot;
          return {
            ...user,
            counts: {
              clients: await getCountForUser(clientsTable, user.id),
              projects: await getCountForUser(projectsTable, user.id),
              timeEntries: await getCountForUser(timeEntriesTable, user.id),
              invoices: await getCountForUser(invoicesTable, user.id),
              timeEntryNotes: await getCountForUser(timeEntryNotesTable, user.id),
              creativityNotes: await getCountForUser(creativityNotesTable, user.id),
              weeklyGoals: await getCountForUser(weeklyGoalsTable, user.id),
            },
            backup: {
              latestSnapshotAt: latestSnapshot?.completedAt || null,
              status: backupState.status,
              restoreAvailable: backupState.restoreAvailable,
              snapshotId: latestSnapshot?.id || null,
              byteSize: latestSnapshot?.byteSize || null,
              recordCounts: latestSnapshot?.recordCounts || {},
            },
          };
        }),
      );

      res.json(usersWithRecoveryMetadata);
    } catch (error) {
      console.error("Error getting admin users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/admin-users", authenticate, requireAdmin, requireRecentAuthentication, async (req: Request, res: Response) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) {
        return res.status(404).json({ message: "No user exists with that email yet" });
      }

      const [updatedUser] = await db
        .update(usersTable)
        .set({ role: "admin", updatedAt: new Date() })
        .where(eq(usersTable.id, user.id))
        .returning({
          id: usersTable.id,
          email: usersTable.email,
          username: usersTable.username,
          role: usersTable.role,
          status: usersTable.status,
        });

      await recordAdminAuditEvent(req, {
        action: "admin.role_granted",
        targetUserId: updatedUser.id,
      });
      res.json(updatedUser);
    } catch (error) {
      console.error("Error adding admin user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Valid email is required" });
      }
      res.status(500).json({ message: "Failed to add admin role" });
    }
  });

  app.post("/api/admin/users/:id/status", authenticate, requireAdmin, requireRecentAuthentication, async (req: Request, res: Response) => {
    try {
      const userId = Number(req.params.id);
      const { status } = z.object({ status: z.enum(["active", "inactive"]) }).parse(req.body);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }
      if (userId === req.session.userId && status === "inactive") {
        return res.status(400).json({ message: "You cannot freeze your own admin account" });
      }

      const [updatedUser] = await db
        .update(usersTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(usersTable.id, userId))
        .returning({
          id: usersTable.id,
          email: usersTable.email,
          username: usersTable.username,
          role: usersTable.role,
          status: usersTable.status,
        });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (status === "inactive") await revokeUserSessions(userId);
      await recordAdminAuditEvent(req, {
        action: "account.status_changed",
        targetUserId: userId,
        details: { status },
      });
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user status:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Valid status is required" });
      }
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  app.post("/api/admin/users/:id/subscription", authenticate, requireAdmin, requireRecentAuthentication, async (req: Request, res: Response) => {
    try {
      const userId = Number(req.params.id);
      const { plan } = z.object({ plan: z.enum(["free", "pro", "ultimate"]) }).parse(req.body);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: "Invalid user id" });
      }

      const [updatedUser] = await db
        .update(usersTable)
        .set({
          subscriptionPlan: plan,
          subscriptionStatus: getAdminGrantedSubscriptionStatus(plan),
          subscriptionChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId))
        .returning({
          id: usersTable.id,
          email: usersTable.email,
          subscriptionPlan: usersTable.subscriptionPlan,
          subscriptionStatus: usersTable.subscriptionStatus,
          subscriptionChangedAt: usersTable.subscriptionChangedAt,
        });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      await recordAdminAuditEvent(req, {
        action: "subscription.admin_changed",
        targetUserId: userId,
        details: { plan },
      });
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating complimentary subscription:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Valid subscription plan is required" });
      }
      res.status(500).json({ message: "Failed to update subscription plan" });
    }
  });

  app.post("/api/admin/users/:id/force-logout", authenticate, requireAdmin, requireRecentAuthentication, async (req: Request, res: Response) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }

      await revokeUserSessions(userId);
      await recordAdminAuditEvent(req, {
        action: "account.sessions_revoked",
        targetUserId: userId,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error forcing logout:", error);
      res.status(500).json({ message: "Failed to force logout" });
    }
  });

  app.post("/api/admin/backups/run", authenticate, requireAdmin, requireRecentAuthentication, async (req: Request, res: Response) => {
    try {
      const result = await runAccountBackupCycle("manual");
      if (result.status === "not_configured") {
        return res.status(503).json({ message: "Backup storage is not configured yet" });
      }
      await recordAdminAuditEvent(req, {
        action: "backup.cycle_run",
        details: { successful: result.successful, failed: result.failed },
      });
      res.json(result);
    } catch (error) {
      console.error("Manual backup cycle failed:", error);
      res.status(500).json({ message: "Manual backup cycle failed" });
    }
  });

  app.post("/api/admin/users/:id/backup", authenticate, requireAdmin, requireRecentAuthentication, async (req: Request, res: Response) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ message: "Invalid user id" });
      const snapshot = await createAccountSnapshot(userId, "manual");
      await recordAdminAuditEvent(req, {
        action: "backup.account_created",
        targetUserId: userId,
        details: { snapshotId: snapshot.id },
      });
      res.json({ id: snapshot.id, completedAt: snapshot.completedAt, byteSize: snapshot.byteSize });
    } catch (error) {
      // Logged in full server-side, but not echoed: requireBackupConfig() and the
      // AWS SDK put bucket names, endpoints and credential hints in these messages.
      console.error("Manual account backup failed:", error);
      res.status(500).json({ message: "Account backup failed" });
    }
  });

  app.post("/api/admin/users/:id/restore", authenticate, requireAdmin, requireRecentAuthentication, async (req: Request, res: Response) => {
    try {
      const targetUserId = Number(req.params.id);
      const { confirmationEmail } = z.object({ confirmationEmail: z.string().email() }).parse(req.body);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) return res.status(400).json({ message: "Invalid user id" });

      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.email.toLowerCase() !== confirmationEmail.trim().toLowerCase()) {
        return res.status(400).json({ message: "Type the account email exactly to confirm the restore" });
      }
      const latestSnapshot = await getLatestAccountSnapshot(targetUserId);
      if (!latestSnapshot) return res.status(409).json({ message: "This account has no completed snapshot" });

      const adminUserId = req.session?.userId;
      if (!adminUserId) return res.status(401).json({ message: "User not authenticated" });
      const result = await restoreAccountSnapshot({
        adminUserId,
        targetUserId,
        snapshotId: latestSnapshot.id,
      });
      await recordAdminAuditEvent(req, {
        action: "backup.account_restored",
        targetUserId,
        details: { snapshotId: latestSnapshot.id },
      });
      res.json({
        success: true,
        restoredSnapshotAt: result.restoredSnapshot.completedAt,
        safetySnapshotId: result.safetySnapshot.id,
      });
    } catch (error) {
      // See the note on the backup route above: raw provider errors carry
      // storage endpoint and bucket detail and must not reach a response body.
      console.error("Account restore failed:", error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: "A valid confirmation email is required" });
      res.status(500).json({ message: "Account restore failed" });
    }
  });
  
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
  
  app.get("/api/clients/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req, res);
      if (!userId) return;

      const id = parseInt(req.params.id);
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
      if (!isOwnedByUser(client.userId, userId)) {
        return res.status(403).json({ message: 'You are not authorized to view this client' });
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
  
  app.put("/api/clients/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req, res);
      if (!userId) return;

      const id = parseInt(req.params.id);
      const existingClient = await storage.getClient(id);
      if (!existingClient) {
        return res.status(404).json({ message: 'Client not found' });
      }
      if (!isOwnedByUser(existingClient.userId, userId)) {
        return res.status(403).json({ message: 'You are not authorized to update this client' });
      }

      const data = insertClientSchema.parse(req.body);
      const client = await storage.updateClient(id, { ...data, userId });
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
  
  app.delete("/api/clients/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req, res);
      if (!userId) return;

      const id = parseInt(req.params.id);
      const existingClient = await storage.getClient(id);
      if (!existingClient) {
        return res.status(404).json({ message: 'Client not found' });
      }
      if (!isOwnedByUser(existingClient.userId, userId)) {
        return res.status(403).json({ message: 'You are not authorized to delete this client' });
      }

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
  
  app.get("/api/projects/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req, res);
      if (!userId) return;

      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      if (!isOwnedByUser(project.userId, userId)) {
        return res.status(403).json({ message: 'You are not authorized to view this project' });
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
      const projectClient = await storage.getClient(data.clientId);
      if (!projectClient || !isOwnedByUser(projectClient.userId, userId)) {
        return res.status(403).json({ message: 'The selected client is not available to this account' });
      }
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
  
  app.put("/api/projects/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req, res);
      if (!userId) return;

      const id = parseInt(req.params.id);
      const existingProject = await storage.getProject(id);
      if (!existingProject) {
        return res.status(404).json({ message: 'Project not found' });
      }
      if (!isOwnedByUser(existingProject.userId, userId)) {
        return res.status(403).json({ message: 'You are not authorized to update this project' });
      }

      const data = insertProjectSchema.parse(req.body);
      const projectClient = await storage.getClient(data.clientId);
      if (!projectClient || !isOwnedByUser(projectClient.userId, userId)) {
        return res.status(403).json({ message: 'The selected client is not available to this account' });
      }
      const project = await storage.updateProject(id, { ...data, userId });
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
  
  app.delete("/api/projects/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req, res);
      if (!userId) return;

      const id = parseInt(req.params.id);
      const existingProject = await storage.getProject(id);
      if (!existingProject) {
        return res.status(404).json({ message: 'Project not found' });
      }
      if (!isOwnedByUser(existingProject.userId, userId)) {
        return res.status(403).json({ message: 'You are not authorized to delete this project' });
      }

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
      const timeEntries = await storage.getTimeEntriesByUser(userId);
      const projects = await storage.getProjectsByUser(userId);
      const clients = await storage.getClientsByUser(userId);
      
      // Enrich time entries with project and client data including colors
      const enrichedEntries = timeEntries.map(entry => {
        const project = projects.find(p => p.id === entry.projectId);
        // Client can come from project relationship or direct clientId field
        let client = project ? clients.find(c => c.id === project.clientId) : null;
        if (!client && entry.clientId) {
          client = clients.find(c => c.id === entry.clientId);
        }
        
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
  
  // Time Entry Notes API
  //
  // Note counts for every entry the account owns, in one request.
  //
  // The tracker previously rendered one <NotesButton> per time entry and each
  // one ran its own GET /api/time-entries/:id/notes purely to decide whether the
  // icon should be tinted. On an account with a normal amount of history that
  // was 40+ requests per page load — measured at 387 of 600 logged requests in a
  // short session here — which is enough for a user to trip the 600-per-15-minute
  // API limiter and be signed out of their own tracker.
  //
  // Registered before the ":timeEntryId" route so "note-counts" is not parsed as
  // an entry id.
  app.get("/api/time-entries/note-counts", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Scoped by the note's owner, which is the same ownership rule the
      // per-entry route enforces.
      const rows = await db
        .select({
          timeEntryId: timeEntryNotesTable.timeEntryId,
          total: sql<number>`count(*)::int`,
        })
        .from(timeEntryNotesTable)
        .where(eq(timeEntryNotesTable.userId, userId))
        .groupBy(timeEntryNotesTable.timeEntryId);

      const counts: Record<string, number> = {};
      for (const row of rows) {
        counts[String(row.timeEntryId)] = Number(row.total) || 0;
      }

      res.json({ counts });
    } catch (error) {
      console.error('Error getting time entry note counts:', error);
      res.status(500).json({ message: 'Failed to fetch note counts' });
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

      const relationError = await validateTimeEntryRelations(userId, data);
      if (relationError) {
        return res.status(403).json({ message: relationError });
      }
      
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
      
      // This route used to spread req.body straight into the insert. Because
      // DatabaseStorage.createTimeEntry forwards `invoiceId` when present, that
      // let a caller attach their entry to any other tenant's invoice — and it
      // defeated insertTimeEntrySchema, which deliberately omits invoiceId.
      // The tracker sends ISO strings, so timestamps are coerced here rather
      // than relying on the shared schema's Date fields.
      const trackerEntrySchema = z.object({
        description: z.string().trim().max(1000).nullish(),
        projectId: z.number().int().positive().nullish(),
        clientId: z.number().int().positive().nullish(),
        duration: z.union([z.string(), z.number()]).nullish(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        startTime: z.string().datetime({ offset: true }).optional(),
        endTime: z.string().datetime({ offset: true }).optional(),
      });

      const parsed = trackerEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid time entry data', errors: parsed.error.errors });
      }

      const startTime = parsed.data.startTime ? new Date(parsed.data.startTime) : new Date();

      const relationError = await validateTimeEntryRelations(userId, parsed.data);
      if (relationError) {
        return res.status(403).json({ message: relationError });
      }

      // Allow projectId to be null for entries without projects
      const data = {
        ...parsed.data,
        userId: userId,
        startTime: startTime,
        endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : undefined,
        date: parsed.data.date || startTime.toISOString().split('T')[0],
      };

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
      const relationError = await validateTimeEntryRelations(userId, {
        projectId: data.projectId === undefined ? existingEntry.projectId : data.projectId,
        clientId: data.clientId === undefined ? existingEntry.clientId : data.clientId,
      });
      if (relationError) {
        return res.status(403).json({ message: relationError });
      }
      console.log('Updating time entry with data:', JSON.stringify(data, null, 2));
      const timeEntry = await storage.updateTimeEntry(id, data as any);
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
      
      // Get all projects and clients for enrichment
      const projects = await storage.getProjectsByUser(userId);
      const clients = await storage.getClientsByUser(userId);
      const settings = await storage.getSettings(userId);
      
      // Enrich entries with client and project data, including rate calculations
      const enrichedEntries = await Promise.all(entries.map(async (entry) => {
        const project = projects.find(p => p.id === entry.projectId);
        const client = clients.find(c => c.id === (project?.clientId ?? entry.clientId));
        
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
        
        // Use client currency since projects don't have a currency field.
        const projectCurrency = client?.currency || settings?.defaultCurrency || 'USD';
        
        console.log(`Entry ${entry.id}: ${durationHours}h × ${hourlyRateValue} ${projectCurrency} = ${amount} ${projectCurrency}`);
        
        // Keep amounts in their original currency to avoid confusion
        const convertedAmount = amount;
        
        return {
          ...entry,
          client,
          project,
          currency: projectCurrency,
          hourlyRate: project?.hourlyRate || "0",
          amount: convertedAmount.toFixed(2),
          duration: durationHours.toFixed(2),
          originalDuration: durationHours // Preserve full precision for invoice calculations
        };
      }));
      
      // Group entries based on settings
      let groupedData: any = {};
      
      if (settings?.enableWeeklyCategorization) {
        // Group by weeks within month and merge same project/client/description
        groupedData = enrichedEntries.reduce((acc: any, entry) => {
          const { entryDate, weekNumber, weekKey, weekLabel, weekStart } = getCalendarWeekOfMonth(entry.date);
          
          if (!acc[weekKey]) {
            acc[weekKey] = {
              weekNumber,
              weekLabel,
              weekStart,
              totalHours: 0,
              totalAmount: 0,
              entries: [],
              groupedEntries: {}
            };
          }
          
          // Create a grouping key for merging entries by description, project, and client
          const normalizedDescription = (entry.description || '').trim().toLowerCase();
          const groupKey = `${normalizedDescription}-${entry.projectId || 'no-project'}-${entry.client?.id || 'no-client'}`;
          
          if (!acc[weekKey].groupedEntries[groupKey]) {
            acc[weekKey].groupedEntries[groupKey] = {
              ...entry,
              duration: 0,
              amount: 0,
              originalDuration: 0,
              mergedCount: 0,
              dates: [] // Track all dates for this grouped entry
            };
          }
          
          // Add the date to the dates array if not already present
          const entryDateStr = entry.date;
          if (!acc[weekKey].groupedEntries[groupKey].dates.includes(entryDateStr)) {
            acc[weekKey].groupedEntries[groupKey].dates.push(entryDateStr);
          }
          
          // Merge the entry using original precise duration values
          acc[weekKey].groupedEntries[groupKey].duration += parseFloat(entry.duration);
          acc[weekKey].groupedEntries[groupKey].originalDuration += entry.originalDuration;
          acc[weekKey].groupedEntries[groupKey].amount += parseFloat(entry.amount);
          acc[weekKey].groupedEntries[groupKey].mergedCount += 1;
          
          acc[weekKey].totalHours += parseFloat(entry.duration);
          acc[weekKey].totalAmount += parseFloat(entry.amount);
          
          return acc;
        }, {});
        
        // Convert grouped entries back to arrays and add date range info
        Object.keys(groupedData).forEach(weekKey => {
          groupedData[weekKey].entries = Object.values(groupedData[weekKey].groupedEntries).map((entry: any) => ({
            ...entry,
            duration: entry.duration.toFixed(6),
            originalDuration: entry.originalDuration, // Preserve original duration
            amount: entry.amount.toFixed(2),
            // Use the first date from the grouped dates for display
            date: entry.dates[0],
            // Add a note about how many sessions were merged
            sessionCount: entry.mergedCount,
            dateRange: entry.dates.length > 1 ? `${entry.dates.length} sessions` : null
          })).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by date ascending
          delete groupedData[weekKey].groupedEntries;
        });
      } else {
        // Group everything into a single period and merge same project/client/description
        const groupedEntries = enrichedEntries.reduce((acc: any, entry) => {
          // Create a grouping key for merging entries by description, project, and client
          const normalizedDescription = (entry.description || '').trim().toLowerCase();
          const groupKey = `${normalizedDescription}-${entry.projectId || 'no-project'}-${entry.client?.id || 'no-client'}`;
          
          if (!acc[groupKey]) {
            acc[groupKey] = {
              ...entry,
              duration: 0,
              amount: 0,
              originalDuration: 0,
              mergedCount: 0,
              dates: [] // Track all dates for this grouped entry
            };
          }
          
          // Add the date to the dates array if not already present
          const entryDateStr = entry.date;
          if (!acc[groupKey].dates.includes(entryDateStr)) {
            acc[groupKey].dates.push(entryDateStr);
          }
          
          acc[groupKey].duration += parseFloat(entry.duration);
          acc[groupKey].originalDuration += entry.originalDuration;
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
              originalDuration: entry.originalDuration, // Preserve original duration
              amount: entry.amount.toFixed(2),
              // Use the first date from the grouped dates for display
              date: entry.dates[0],
              // Add a note about how many sessions were merged
              sessionCount: entry.mergedCount,
              dateRange: entry.dates.length > 1 ? `${entry.dates.length} sessions` : null
            })).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Sort by date ascending
          }
        };
      }
      
      const weeklyData = Object.values(groupedData).sort((a: any, b: any) => {
        const aTime = a.weekStart ? new Date(a.weekStart).getTime() : a.weekNumber;
        const bTime = b.weekStart ? new Date(b.weekStart).getTime() : b.weekNumber;
        return aTime - bTime;
      });
      
      // Calculate totals from the grouped data
      const totalHours = weeklyData.reduce((sum: number, week: any) => sum + week.totalHours, 0);
      const totalAmount = weeklyData.reduce((sum: number, week: any) => sum + week.totalAmount, 0);
      const reportCurrencies = Array.from(new Set(enrichedEntries.map((entry: any) => entry.currency).filter(Boolean)));
      const reportCurrency = reportCurrencies.length === 1 ? reportCurrencies[0] : settings?.defaultCurrency || 'USD';
      
      return res.json({
        timeEntries: enrichedEntries,
        weeklyData,
        totalHours,
        totalAmount,
        currency: reportCurrency,
        timeFormat: filters.timeFormat,
        roundingType: filters.roundingType
      });
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({ message: 'Failed to generate report' });
    }
  });
  
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
      
      if (!isOwnedByUser(invoice.userId, req.user!.id)) {
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
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const invoiceNumber = req.params.number;
      const invoice = await storage.getInvoiceByNumber(userId, invoiceNumber);

      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }

      res.json(invoice);
    } catch (error) {
      console.error('Error getting invoice by number:', error);
      res.status(500).json({ message: 'Failed to fetch invoice' });
    }
  });
  
  app.post("/api/invoices", authenticate, requireInvoicePro, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Extract timeEntryIds before Zod parsing (not in schema, used separately)
      const { timeEntryIds: rawTimeEntryIds, ...bodyRest } = req.body;

      // Validate the id list rather than trusting the body shape.
      const timeEntryIdsResult = z
        .array(z.number().int().positive())
        .max(5000)
        .optional()
        .safeParse(rawTimeEntryIds);

      if (!timeEntryIdsResult.success) {
        return res.status(400).json({ message: 'Invalid time entry selection' });
      }

      const timeEntryIds = timeEntryIdsResult.data;

      const data = insertInvoiceSchema.parse(bodyRest);

      // An invoice may only be raised against a client this account owns.
      // Without this a caller could point client_id at another tenant's client.
      const invoiceClient = await storage.getClient(data.clientId);
      if (!invoiceClient || !isOwnedByUser(invoiceClient.userId, userId)) {
        return res.status(403).json({ message: 'The selected client is not available to this account' });
      }

      const invoice = await storage.createInvoice({ ...data, userId });

      // Link time entries to this invoice.
      // The userId predicate is load-bearing: without it any Pro account could
      // stamp its own invoiceId onto every other tenant's time entries, which
      // removes them from their owners' uninvoiced pool and silently under-bills.
      if (timeEntryIds && timeEntryIds.length > 0) {
        await db.update(timeEntriesTable)
          .set({ invoiceId: invoice.id })
          .where(and(
            eq(timeEntriesTable.userId, userId),
            inArray(timeEntriesTable.id, timeEntryIds),
          ));
      }

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
  
  // PATCH for partial invoice status updates
  app.patch("/api/invoices/:id/status", authenticate, requireInvoicePro, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!['draft', 'sent', 'paid'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Must be draft, sent, or paid.' });
      }
      
      const existingInvoice = await storage.getInvoice(id);
      if (!existingInvoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      
      const userId = req.session?.userId;
      if (!userId || !isOwnedByUser(existingInvoice.userId, userId)) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      const invoice = await storage.updateInvoice(id, { status });
      res.json(invoice);
    } catch (error) {
      console.error('Error updating invoice status:', error);
      res.status(500).json({ message: 'Failed to update invoice status' });
    }
  });

  app.put("/api/invoices/:id", authenticate, requireInvoicePro, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // First verify the user owns this invoice
      const existingInvoice = await storage.getInvoice(id);
      if (!existingInvoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      
      // Check if invoice belongs to current user
      const userId = req.session?.userId;
      if (!userId || !isOwnedByUser(existingInvoice.userId, userId)) {
        return res.status(403).json({ message: 'You are not authorized to update this invoice' });
      }
      
      // Use partial schema to allow partial updates.
      // `userId` is stripped: it is a column on `invoices`, so createInsertSchema
      // accepted it, and after passing the ownership check above a caller could
      // otherwise re-parent one of their own invoices into another account by
      // sending {"userId": <victim id>}. It is server-owned, never client input.
      const data = insertInvoiceSchema
        .omit({ userId: true })
        .partial()
        .parse(req.body);

      // Reassigning the invoice to a different client is allowed, but only to a
      // client this account owns.
      if (data.clientId !== undefined && data.clientId !== existingInvoice.clientId) {
        const nextClient = await storage.getClient(data.clientId);
        if (!nextClient || !isOwnedByUser(nextClient.userId, userId)) {
          return res.status(403).json({ message: 'The selected client is not available to this account' });
        }
      }

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
      
      if (!isOwnedByUser(existingInvoice.userId, req.user!.id)) {
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
  
  app.get("/api/next-invoice-number", authenticate, requireInvoicePro, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const settings = await storage.getSettings(userId);
      const clientId = req.query.clientId ? Number(req.query.clientId) : null;
      let clientOptions: Record<string, any> = {};

      if (clientId) {
        const client = await storage.getClient(clientId);
        if (client && isOwnedByUser(client.userId, req.user!.id)) {
          const invoiceSettings = parseInvoiceSettings((client as any).invoiceSettings);
          if (invoiceSettings.enabled) {
            clientOptions = invoiceSettings;
          }
        }
      }

      const invoiceNumber = await storage.getNextInvoiceNumber(userId, {
        prefix: clientOptions.invoiceNumberPrefix ?? (settings as any)?.invoiceNumberPrefix ?? "INV-",
        suffix: clientOptions.invoiceNumberSuffix ?? (settings as any)?.invoiceNumberSuffix ?? "",
        padding: clientOptions.invoiceNumberPadding ?? (settings as any)?.invoiceNumberPadding ?? 4,
      });
      res.json({ invoiceNumber });
    } catch (error) {
      console.error('Error getting next invoice number:', error);
      res.status(500).json({ message: 'Failed to get next invoice number' });
    }
  });

  app.get("/api/exchange-rates", authenticate, async (req: Request, res: Response) => {
    try {
      const base = typeof req.query.base === "string" ? req.query.base : "USD";
      const symbols = typeof req.query.symbols === "string"
        ? req.query.symbols.split(",")
        : [];
      const rates = await getLiveExchangeRates(base, symbols);
      res.json(rates);
    } catch (error) {
      console.error("Error getting live exchange rates:", error);
      res.status(502).json({ message: "Failed to fetch live exchange rates" });
    }
  });
  
  // Settings API
  app.get("/api/settings", authenticate, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings(req.user!.id);
      res.json(settings);
    } catch (error) {
      console.error('Error getting settings:', error);
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  });
  
  app.put("/api/settings", authenticate, async (req: Request, res: Response) => {
    try {
      const data = insertSettingsSchema.partial().parse(req.body);
      if (data.companyLogo) {
        const logo = validateProfileImageDataUrl(data.companyLogo);
        if (!logo.valid) return res.status(400).json({ message: logo.message });
        data.companyLogo = logo.value;
      }
      if (data.defaultCurrency) {
        data.defaultCurrency = data.defaultCurrency.trim().toUpperCase();
      }
      const settings = await storage.updateSettings(req.user!.id, data);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('[Settings] Schema validation failed:', error.errors);
        return res.status(400).json({ 
          message: 'Invalid settings data', 
          errors: error.errors 
        });
      }
      console.error('[Settings] Error updating settings:', error);
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });

  app.get("/api/invoice-label-overrides", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req, res);
      if (!userId) return;

      const user = await storage.getUser(userId);
      const rawLabels = (user as any)?.invoiceLabelOverrides;
      let labels = {};

      if (rawLabels) {
        try {
          labels = JSON.parse(rawLabels);
        } catch {
          labels = {};
        }
      }

      res.json({ labels });
    } catch (error) {
      console.error("Error getting invoice label overrides:", error);
      res.status(500).json({ message: "Failed to fetch invoice label overrides" });
    }
  });

  app.put("/api/invoice-label-overrides", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req, res);
      if (!userId) return;

      const schema = z.object({
        labels: z.record(z.string().max(500)),
      });
      const { labels } = schema.parse(req.body);

      const [updatedUser] = await db
        .update(usersTable)
        .set({ invoiceLabelOverrides: JSON.stringify(labels), updatedAt: new Date() })
        .where(eq(usersTable.id, userId))
        .returning();

      res.json({ labels: JSON.parse((updatedUser as any).invoiceLabelOverrides || "{}") });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice label overrides", errors: error.errors });
      }
      console.error("Error updating invoice label overrides:", error);
      res.status(500).json({ message: "Failed to update invoice label overrides" });
    }
  });

  app.get("/api/custom-currency-rates", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req, res);
      if (!userId) return;

      const user = await storage.getUser(userId);
      const rawRates = (user as any)?.customCurrencyRates;
      let currencies = {};

      if (rawRates) {
        try {
          currencies = JSON.parse(rawRates);
        } catch {
          currencies = {};
        }
      }

      res.json({ currencies });
    } catch (error) {
      console.error("Error getting custom currency rates:", error);
      res.status(500).json({ message: "Failed to fetch custom currency rates" });
    }
  });

  app.put("/api/custom-currency-rates", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req, res);
      if (!userId) return;

      const schema = z.object({
        currencies: z.record(z.object({
          code: z.string().min(2).max(12),
          name: z.string().max(80).optional().default(""),
          rate: z.coerce.number().positive(),
        })),
      });
      const { currencies } = schema.parse(req.body);

      const normalized = Object.values(currencies).reduce<Record<string, { code: string; name: string; rate: number }>>((acc, item) => {
        const code = item.code.trim().toUpperCase();
        acc[code] = { code, name: item.name || code, rate: item.rate };
        return acc;
      }, {});

      const [updatedUser] = await db
        .update(usersTable)
        .set({ customCurrencyRates: JSON.stringify(normalized), updatedAt: new Date() })
        .where(eq(usersTable.id, userId))
        .returning();

      res.json({ currencies: JSON.parse((updatedUser as any).customCurrencyRates || "{}") });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid custom currency rates", errors: error.errors });
      }
      console.error("Error updating custom currency rates:", error);
      res.status(500).json({ message: "Failed to update custom currency rates" });
    }
  });

  // Creativity Notes Routes
  // Bounded schemas for the creative panel. These routes previously spread
  // req.body straight into the insert/update, so a caller could store unbounded
  // strings and any wrong type surfaced as a raw 500 from the driver.
  const creativityNoteInputSchema = z.object({
    title: z.string().trim().max(200).nullish(),
    content: z.string().max(20000),
    category: z.string().trim().max(60).nullish(),
    tags: z.string().trim().max(500).nullish(),
    isPinned: z.boolean().optional(),
  });

  const weeklyGoalInputSchema = z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(5000).nullish(),
    isCompleted: z.boolean().optional(),
    priority: z.enum(["high", "medium", "low"]).nullish(),
    weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    completedAt: z.coerce.date().nullish(),
  });

  app.get("/api/creativity/notes", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const notes = await storage.getCreativityNotes(userId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/creativity/notes", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const parsed = creativityNoteInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid note data", errors: parsed.error.errors });
      }
      const note = await storage.createCreativityNote({ ...parsed.data, userId });
      res.json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.put("/api/creativity/notes/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.id);
      const [existingNote] = await db
        .select({ userId: creativityNotesTable.userId })
        .from(creativityNotesTable)
        .where(eq(creativityNotesTable.id, noteId));
      if (!existingNote) return res.status(404).json({ message: "Note not found" });
      if (!isOwnedByUser(existingNote.userId, req.user!.id)) {
        return res.status(403).json({ message: "You are not authorized to update this note" });
      }
      const parsedUpdate = creativityNoteInputSchema.partial().safeParse(req.body);
      if (!parsedUpdate.success) {
        return res.status(400).json({ message: "Invalid note data", errors: parsedUpdate.error.errors });
      }
      const note = await storage.updateCreativityNote(noteId, parsedUpdate.data);
      res.json(note);
    } catch (error) {
      console.error("Error updating note:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  app.delete("/api/creativity/notes/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.id);
      const [existingNote] = await db
        .select({ userId: creativityNotesTable.userId })
        .from(creativityNotesTable)
        .where(eq(creativityNotesTable.id, noteId));
      if (!existingNote) return res.status(404).json({ message: "Note not found" });
      if (!isOwnedByUser(existingNote.userId, req.user!.id)) {
        return res.status(403).json({ message: "You are not authorized to delete this note" });
      }
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
      const userId = req.user!.id;
      const goals = await storage.getWeeklyGoals(userId);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post("/api/creativity/goals", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const parsed = weeklyGoalInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid goal data", errors: parsed.error.errors });
      }
      const goal = await storage.createWeeklyGoal({ ...parsed.data, userId });
      res.json(goal);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(500).json({ message: "Failed to create goal" });
    }
  });

  app.put("/api/creativity/goals/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const goalId = parseInt(req.params.id);
      const [existingGoal] = await db
        .select({ userId: weeklyGoalsTable.userId })
        .from(weeklyGoalsTable)
        .where(eq(weeklyGoalsTable.id, goalId));
      if (!existingGoal) return res.status(404).json({ message: "Goal not found" });
      if (!isOwnedByUser(existingGoal.userId, req.user!.id)) {
        return res.status(403).json({ message: "You are not authorized to update this goal" });
      }
      const parsedUpdate = weeklyGoalInputSchema.partial().safeParse(req.body);
      if (!parsedUpdate.success) {
        return res.status(400).json({ message: "Invalid goal data", errors: parsedUpdate.error.errors });
      }
      const goal = await storage.updateWeeklyGoal(goalId, parsedUpdate.data);
      res.json(goal);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  app.delete("/api/creativity/goals/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const goalId = parseInt(req.params.id);
      const [existingGoal] = await db
        .select({ userId: weeklyGoalsTable.userId })
        .from(weeklyGoalsTable)
        .where(eq(weeklyGoalsTable.id, goalId));
      if (!existingGoal) return res.status(404).json({ message: "Goal not found" });
      if (!isOwnedByUser(existingGoal.userId, req.user!.id)) {
        return res.status(403).json({ message: "You are not authorized to delete this goal" });
      }
      await storage.deleteWeeklyGoal(goalId);
      res.json({ message: "Goal deleted successfully" });
    } catch (error) {
      console.error("Error deleting goal:", error);
      res.status(500).json({ message: "Failed to delete goal" });
    }
  });

  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie(SESSION_COOKIE_NAME, {
        ...sessionCookieOptions,
        maxAge: undefined,
      });
      res.json({ message: "Logged out" });
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
