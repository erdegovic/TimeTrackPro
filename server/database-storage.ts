import { 
  User, InsertUser, users,
  Verification, verifications,
  Client, InsertClient, clients,
  Project, InsertProject, projects,
  TimeEntry, InsertTimeEntry, timeEntries,
  TimeEntryNote, InsertTimeEntryNote, timeEntryNotes,
  Invoice, InsertInvoice, invoices,
  Settings, InsertSettings, settings,
  creativityNotes, weeklyGoals,
  ReportFilters
} from "@shared/schema";
import { db, pool } from "./db";
import * as schema from "@shared/schema";
import { eq, and, between, desc, sql, like, isNull, not } from "drizzle-orm";
import { IStorage } from "./storage";
import { addWeeks, format, startOfWeek, endOfWeek, getWeekOfMonth, getYear, getMonth } from "date-fns";
import { formatInvoiceNumber, InvoiceNumberOptions } from "@shared/invoice-number";

// A running server-side timer is a time_entries row with end_time IS NULL AND
// duration IS NULL (see server/time-tracking.ts). Lists, reports and invoices only
// ever see completed entries.
const completedTimeEntries = () => not(and(isNull(timeEntries.endTime), isNull(timeEntries.duration))!);

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`);
    return user;
  }

  async getUserByGoogleSubject(subject: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleSubject, subject));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Verification methods
  async createVerification(verification: Omit<Verification, "id">): Promise<Verification> {
    try {
      const [result] = await db
        .insert(verifications)
        .values(verification)
        .returning();
      return result;
    } catch (error) {
      console.error('Database: Failed to create verification record:', error);
      throw error;
    }
  }

  async getVerificationByToken(token: string): Promise<Verification | undefined> {
    const [verification] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.token, token));
    return verification;
  }
  
  async getVerificationsByUser(userId: number): Promise<Verification[]> {
    return await db
      .select()
      .from(verifications)
      .where(eq(verifications.userId, userId));
  }

  async deleteVerification(token: string): Promise<void> {
    await db.delete(verifications).where(eq(verifications.token, token));
  }
  
  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.resetPasswordToken, token));
    return user;
  }

  // Clients methods
  async getClients(): Promise<Client[]> {
    return await db.select().from(clients);
  }

  async getClientsByUser(userId: number): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.userId, userId));
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [result] = await db.insert(clients).values(client).returning();
    return result;
  }

  async updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined> {
    const [updatedClient] = await db
      .update(clients)
      .set(client)
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
  }

  async deleteClient(id: number): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Projects methods
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async getProjectsByUser(userId: number): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.userId, userId));
  }

  async getProjectsByClient(clientId: number): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.clientId, clientId));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [result] = await db.insert(projects).values(project).returning();
    return result;
  }

  async updateProject(
    id: number,
    project: Partial<InsertProject>
  ): Promise<Project | undefined> {
    const [updatedProject] = await db
      .update(projects)
      .set(project)
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }

  async deleteProject(id: number): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Time Entries methods
  async getTimeEntries(): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries).orderBy(desc(timeEntries.date));
  }

  async getTimeEntriesByUser(userId: number): Promise<TimeEntry[]> {
    try {
      return await db
        .select()
        .from(timeEntries)
        .where(and(eq(timeEntries.userId, userId), completedTimeEntries()))
        .orderBy(desc(timeEntries.date), desc(timeEntries.id));
    } catch (error) {
      console.error('[DB] Error querying time entries:', error);
      throw error;
    }
  }

  async getTimeEntriesByProject(projectId: number): Promise<TimeEntry[]> {
    return await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.projectId, projectId))
      .orderBy(desc(timeEntries.date));
  }

  async getTimeEntriesByDateRange(
    startDate: string,
    endDate: string
  ): Promise<TimeEntry[]> {
    return await db
      .select()
      .from(timeEntries)
      .where(
        and(
          sql`${timeEntries.date} >= ${startDate}`,
          sql`${timeEntries.date} <= ${endDate}`
        )
      )
      .orderBy(desc(timeEntries.date));
  }

  async getTimeEntriesByFilters(filters: ReportFilters & { userId?: number }): Promise<TimeEntry[]> {
    let whereConditions = [completedTimeEntries()];

    // Filter by user ID (most important)
    if (filters.userId) {
      whereConditions.push(eq(timeEntries.userId, filters.userId));
    }

    // Filter by client (through projects)
    if (filters.clientId) {
      whereConditions.push(
        sql`${timeEntries.projectId} IN (
          SELECT ${projects.id} FROM ${projects} 
          WHERE ${projects.clientId} = ${filters.clientId}
        )`
      );
    }

    // Filter by project
    if (filters.projectId) {
      whereConditions.push(eq(timeEntries.projectId, filters.projectId));
    }

    // Filter by date range
    if (filters.startDate && filters.endDate) {
      whereConditions.push(
        sql`${timeEntries.date} >= ${filters.startDate}`
      );
      whereConditions.push(
        sql`${timeEntries.date} <= ${filters.endDate}`
      );
    }

    // Only filter by invoice status if specifically requested
    if (filters.excludeInvoiced) {
      whereConditions.push(sql`${timeEntries.invoiceId} IS NULL`);
    }

    const query = db
      .select()
      .from(timeEntries)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(timeEntries.date));

    return await query;
  }

  async getTimeEntry(id: number): Promise<TimeEntry | undefined> {
    const [entry] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id));
    return entry;
  }

  async createTimeEntry(entryData: InsertTimeEntry): Promise<TimeEntry> {
    // Determine date string with robust fallbacks
    let dateString: string;
    if (entryData.date && typeof entryData.date === 'string' && entryData.date.trim().length > 0) {
      dateString = entryData.date.trim();
    } else if (entryData.startTime) {
      const startDate = new Date(entryData.startTime);
      dateString = startDate.toISOString().substring(0, 10); // YYYY-MM-DD format
    } else {
      const now = new Date();
      dateString = now.toISOString().substring(0, 10); // YYYY-MM-DD format
    }
    
    // Create working date object for calculations
    const workingDate = new Date(dateString + 'T12:00:00.000Z'); // Force UTC midday
    // Calculate all week/date related fields manually
    const weekStart = startOfWeek(workingDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(workingDate, { weekStartsOn: 1 });
    const weekNumber = getWeekOfMonth(workingDate);
    const weekLabel = `Week ${weekNumber} (${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')})`;
    const month = format(workingDate, 'yyyy-MM');
    const year = getYear(workingDate);
    
    // Build the complete entry object
    const completeEntry = {
      description: entryData.description || '',
      projectId: entryData.projectId || null,
      clientId: entryData.clientId || null,
      userId: entryData.userId || null,
      startTime: entryData.startTime || new Date(),
      endTime: entryData.endTime || null,
      duration: entryData.duration || null,
      date: dateString,
      weekNumber,
      weekLabel,
      month,
      year,
      invoiceId: (entryData as any).invoiceId || null
    };
    
    try {
      const [result] = await db.insert(timeEntries).values(completeEntry).returning();
      return result;
    } catch (error) {
      console.error('=== DATABASE INSERT ERROR ===');
      console.error('Error details:', error);
      throw error;
    }
  }

  async updateTimeEntry(
    id: number,
    entryData: Partial<InsertTimeEntry>
  ): Promise<TimeEntry | undefined> {
    // Convert string timestamps to Date objects if present
    if (entryData.startTime && typeof entryData.startTime === 'string') {
      entryData.startTime = new Date(entryData.startTime);
    }
    if (entryData.endTime && typeof entryData.endTime === 'string') {
      entryData.endTime = new Date(entryData.endTime);
    }

    // Handle date change if it's present
    if (entryData.date) {
      const date = entryData.date;
      const parsedDate = new Date(`${date}T12:00:00.000Z`);
      
      // Recalculate week-related fields
      const weekStart = startOfWeek(parsedDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(parsedDate, { weekStartsOn: 1 });
      const weekNumber = getWeekOfMonth(parsedDate);
      const weekLabel = `Week ${weekNumber} (${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')})`;
      const month = format(parsedDate, 'yyyy-MM');
      const year = getYear(parsedDate);

      entryData = {
        ...entryData,
        weekNumber,
        weekLabel,
        month,
        year,
      };
    }

    const [updatedEntry] = await db
      .update(timeEntries)
      .set(entryData)
      .where(eq(timeEntries.id, id))
      .returning();
    return updatedEntry;
  }

  async deleteTimeEntry(id: number): Promise<boolean> {
    const result = await db.delete(timeEntries).where(eq(timeEntries.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Invoices methods
  async getInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices).orderBy(invoices.issueDate);
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id));
    return invoice;
  }

  /**
   * Invoice numbers are unique per (userId, invoiceNumber), not globally — every
   * account starts at INV-1001, so duplicates across accounts are the norm. The
   * previous global lookup returned whichever row Postgres happened to yield
   * first, which could 403 a user out of their own invoice.
   */
  async getInvoiceByNumber(userId: number, invoiceNumber: string): Promise<Invoice | undefined> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.userId, userId), eq(invoices.invoiceNumber, invoiceNumber)));
    return invoice;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [result] = await db.insert(invoices).values(invoice).returning();

    const settingsData = invoice.userId ? await this.getSettings(invoice.userId) : undefined;
    if (settingsData && invoice.userId) {
      await db
        .update(settings)
        .set({ nextInvoiceNumber: sql`${settings.nextInvoiceNumber} + 1` })
        .where(and(eq(settings.id, settingsData.id), eq(settings.userId, invoice.userId)));
    }

    return result;
  }

  async updateInvoice(
    id: number,
    invoice: Partial<InsertInvoice>
  ): Promise<Invoice | undefined> {
    const [updatedInvoice] = await db
      .update(invoices)
      .set(invoice)
      .where(eq(invoices.id, id))
      .returning();
    return updatedInvoice;
  }

  async deleteInvoice(id: number): Promise<boolean> {
    // Clear invoice reference from time entries
    await db
      .update(timeEntries)
      .set({ invoiceId: null })
      .where(eq(timeEntries.invoiceId, id));
      
    const result = await db.delete(invoices).where(eq(invoices.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getNextInvoiceNumber(userId: number, options: InvoiceNumberOptions = {}): Promise<string> {
    const settingsData = await this.getSettings(userId);
    if (!settingsData) {
      // Create default settings if none exist
      const settings = await this.createDefaultSettings(userId);
      return formatInvoiceNumber(settings.nextInvoiceNumber, options);
    }
    
    const nextNumber = settingsData.nextInvoiceNumber ?? 1001;
    const numberingOptions = {
      prefix: options.prefix ?? (settingsData as any).invoiceNumberPrefix ?? "INV-",
      suffix: options.suffix ?? (settingsData as any).invoiceNumberSuffix ?? "",
      padding: options.padding ?? (settingsData as any).invoiceNumberPadding ?? 4,
    };
    
    return formatInvoiceNumber(nextNumber, numberingOptions);
  }

  // Settings methods
  async getSettings(userId: number): Promise<Settings | undefined> {
    const [settingsData] = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId));
    
    if (!settingsData) {
      return this.createDefaultSettings(userId);
    }
    
    return settingsData;
  }

  async updateSettings(
    userId: number,
    settingsData: Partial<InsertSettings>
  ): Promise<Settings> {
    // Get current settings or create default if none exist
    const currentSettings = await this.getSettings(userId);
    
    if (!currentSettings) {
      return this.createDefaultSettings(userId, settingsData);
    }
    
    const [updatedSettings] = await db
      .update(settings)
      .set(settingsData)
      .where(and(eq(settings.id, currentSettings.id), eq(settings.userId, userId)))
      .returning();
      
    return updatedSettings;
  }

  private async createDefaultSettings(userId: number, overrides: Partial<InsertSettings> = {}): Promise<Settings> {
    const defaultSettings = { ...this.getDefaultSettings(), ...overrides, userId };
    const [createdSettings] = await db
      .insert(settings)
      .values(defaultSettings)
      .onConflictDoNothing({ target: settings.userId })
      .returning();
    if (createdSettings) return createdSettings;

    const [existingSettings] = await db.select().from(settings).where(eq(settings.userId, userId));
    if (!existingSettings) throw new Error(`Could not create settings for user ${userId}`);
    return existingSettings;
  }

  private getDefaultSettings(): InsertSettings {
    return {
      businessName: "Your Business",
      businessAddress: "123 Business St",
      businessCity: "Business City",
      businessState: "BS",
      businessZipCode: "12345",
      businessCountry: "United States",
      businessPhone: "+1 (555) 123-4567",
      businessEmail: "contact@yourbusiness.com",
      businessTaxId: "123-45-6789",
      bankName: "Business Bank",
      bankAccountName: "Your Business",
      bankAccountNumber: "1234567890",
      bankSortCode: "123456",
      nextInvoiceNumber: 1001,
      invoiceNumberPrefix: "INV-",
      invoiceNumberSuffix: "",
      invoiceNumberPadding: 4,
      defaultTimeFormat: "decimal",
      defaultCurrency: "USD",
      displayCurrency: "$",
      defaultTaxRate: "0",
      enableTax: false,
      showDueDate: true,
      defaultDueDateMode: "calendar_month",
      defaultDueDays: 30,
      showPaymentTerms: false,
      paymentTerms: "Payment is due according to the terms shown on this invoice.",
      invoiceNotes: "Thank you for your business. Payment due within 30 days.",
      showInvoiceNotes: true,
      showProjectName: true,
      invoiceLanguage: "en",
    };
  }

  // Creativity Features - Database storage
  async getCreativityNotes(userId: number): Promise<any[]> {
    const notes = await db.select().from(schema.creativityNotes).where(eq(schema.creativityNotes.userId, userId));
    return notes;
  }

  async createCreativityNote(noteData: any): Promise<any> {
    const [note] = await db
      .insert(schema.creativityNotes)
      .values({
        userId: noteData.userId,
        title: noteData.title,
        content: noteData.content,
        category: noteData.category || null,
        tags: noteData.tags || null,
        isPinned: noteData.isPinned || false
      })
      .returning();
    return note;
  }

  async updateCreativityNote(id: number, noteData: any): Promise<any> {
    const [note] = await db
      .update(schema.creativityNotes)
      .set({
        title: noteData.title,
        content: noteData.content,
        category: noteData.category,
        tags: noteData.tags,
        isPinned: noteData.isPinned,
        updatedAt: new Date()
      })
      .where(eq(schema.creativityNotes.id, id))
      .returning();
    return note;
  }

  async deleteCreativityNote(id: number): Promise<void> {
    await db.delete(schema.creativityNotes).where(eq(schema.creativityNotes.id, id));
  }

  async getWeeklyGoals(userId: number): Promise<any[]> {
    const goals = await db.select().from(schema.weeklyGoals).where(eq(schema.weeklyGoals.userId, userId));
    return goals;
  }

  async createWeeklyGoal(goalData: any): Promise<any> {
    const [goal] = await db
      .insert(schema.weeklyGoals)
      .values({
        userId: goalData.userId,
        title: goalData.title,
        description: goalData.description || null,
        isCompleted: goalData.isCompleted || false,
        priority: goalData.priority || null,
        weekOf: goalData.weekOf
      })
      .returning();
    return goal;
  }

  async updateWeeklyGoal(id: number, goalData: any): Promise<any> {
    const [goal] = await db
      .update(schema.weeklyGoals)
      .set({
        title: goalData.title,
        description: goalData.description,
        isCompleted: goalData.isCompleted,
        priority: goalData.priority,
        weekOf: goalData.weekOf,
        completedAt: goalData.isCompleted ? new Date() : null,
        updatedAt: new Date()
      })
      .where(eq(schema.weeklyGoals.id, id))
      .returning();
    return goal;
  }

  async deleteWeeklyGoal(id: number): Promise<void> {
    await db.delete(schema.weeklyGoals).where(eq(schema.weeklyGoals.id, id));
  }

  // Time Entry Notes methods
  async getTimeEntryNotes(timeEntryId: number): Promise<TimeEntryNote[]> {
    return await db.select()
      .from(timeEntryNotes)
      .where(eq(timeEntryNotes.timeEntryId, timeEntryId))
      .orderBy(desc(timeEntryNotes.createdAt));
  }

  async getAllTimeEntryNotes(userId: number): Promise<TimeEntryNote[]> {
    return await db.select()
      .from(timeEntryNotes)
      .where(eq(timeEntryNotes.userId, userId))
      .orderBy(desc(timeEntryNotes.createdAt));
  }

  async createTimeEntryNote(noteData: InsertTimeEntryNote): Promise<TimeEntryNote> {
    const [note] = await db.insert(timeEntryNotes).values(noteData).returning();
    return note;
  }

  async updateTimeEntryNote(id: number, noteData: Partial<InsertTimeEntryNote>): Promise<TimeEntryNote | undefined> {
    const [note] = await db.update(timeEntryNotes)
      .set({ ...noteData, updatedAt: new Date() })
      .where(eq(timeEntryNotes.id, id))
      .returning();
    return note;
  }

  async deleteTimeEntryNote(id: number): Promise<boolean> {
    const result = await db.delete(timeEntryNotes).where(eq(timeEntryNotes.id, id));
    return (result.rowCount || 0) > 0;
  }
}
