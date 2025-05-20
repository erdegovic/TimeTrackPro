import { 
  User, InsertUser, users,
  Verification, verifications,
  Client, InsertClient, clients,
  Project, InsertProject, projects,
  TimeEntry, InsertTimeEntry, timeEntries,
  Invoice, InsertInvoice, invoices,
  Settings, InsertSettings, settings,
  ReportFilters
} from "@shared/schema";
import { db } from "./db";
import { eq, and, between, desc, sql, like } from "drizzle-orm";
import { IStorage } from "./storage";
import { addWeeks, format, parseISO, startOfWeek, endOfWeek, getWeekOfMonth, getYear, getMonth } from "date-fns";

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
    const [user] = await db.select().from(users).where(eq(users.email, email));
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
    return result.rowCount > 0;
  }

  // Verification methods
  async createVerification(verification: Omit<Verification, "id">): Promise<Verification> {
    const [result] = await db
      .insert(verifications)
      .values(verification)
      .returning();
    return result;
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
    return result.rowCount > 0;
  }

  // Projects methods
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects);
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
    return result.rowCount > 0;
  }

  // Time Entries methods
  async getTimeEntries(): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries).orderBy(desc(timeEntries.date));
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

  async getTimeEntriesByFilters(filters: ReportFilters): Promise<TimeEntry[]> {
    let query = db.select().from(timeEntries);

    if (filters.clientId) {
      // To filter by client, we need to join with projects
      query = db
        .select({ timeEntries })
        .from(timeEntries)
        .innerJoin(projects, eq(timeEntries.projectId, projects.id))
        .where(eq(projects.clientId, filters.clientId))
        .orderBy(desc(timeEntries.date)) as any;
    } else if (filters.projectId) {
      query = query.where(eq(timeEntries.projectId, filters.projectId));
    }

    if (filters.startDate && filters.endDate) {
      query = query.where(
        and(
          sql`${timeEntries.date} >= ${filters.startDate}`,
          sql`${timeEntries.date} <= ${filters.endDate}`
        )
      );
    }

    // Only get non-invoiced entries
    query = query.where(sql`${timeEntries.invoiceId} IS NULL`);

    return await query.orderBy(desc(timeEntries.date));
  }

  async getTimeEntry(id: number): Promise<TimeEntry | undefined> {
    const [entry] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id));
    return entry;
  }

  async createTimeEntry(entryData: InsertTimeEntry): Promise<TimeEntry> {
    // Ensure date is in YYYY-MM-DD format
    const date = entryData.date;
    const parsedDate = parseISO(date);
    
    // Calculate week-related fields
    const weekStart = startOfWeek(parsedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(parsedDate, { weekStartsOn: 1 });
    const weekNumber = getWeekOfMonth(parsedDate);
    const weekLabel = `Week ${weekNumber} (${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')})`;
    const month = format(parsedDate, 'yyyy-MM');
    const year = getYear(parsedDate);

    const newEntry = {
      ...entryData,
      weekNumber,
      weekLabel,
      month,
      year,
    };

    const [result] = await db.insert(timeEntries).values(newEntry).returning();
    return result;
  }

  async updateTimeEntry(
    id: number,
    entryData: Partial<InsertTimeEntry>
  ): Promise<TimeEntry | undefined> {
    // Handle date change if it's present
    if (entryData.date) {
      const date = entryData.date;
      const parsedDate = parseISO(date);
      
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
    return result.rowCount > 0;
  }

  // Invoices methods
  async getInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices).orderBy(desc(invoices.issueDate));
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id));
    return invoice;
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, invoiceNumber));
    return invoice;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [result] = await db.insert(invoices).values(invoice).returning();

    // If time entries are associated with this invoice, update them
    if (invoice.id && typeof invoice.id === 'number') {
      await db
        .update(timeEntries)
        .set({ invoiceId: result.id })
        .where(eq(timeEntries.invoiceId, invoice.id));
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
    return result.rowCount > 0;
  }

  async getNextInvoiceNumber(): Promise<string> {
    const settingsData = await this.getSettings();
    if (!settingsData) {
      // Create default settings if none exist
      const settings = await this.createDefaultSettings();
      return settings.nextInvoiceNumber.toString().padStart(4, '0');
    }
    
    const nextNumber = settingsData.nextInvoiceNumber;
    
    // Increment the invoice number in settings
    await db
      .update(settings)
      .set({ nextInvoiceNumber: nextNumber + 1 })
      .where(eq(settings.id, settingsData.id));
      
    return nextNumber.toString().padStart(4, '0');
  }

  // Settings methods
  async getSettings(): Promise<Settings | undefined> {
    const [settingsData] = await db.select().from(settings);
    
    if (!settingsData) {
      return this.createDefaultSettings();
    }
    
    return settingsData;
  }

  async updateSettings(
    settingsData: Partial<InsertSettings>
  ): Promise<Settings> {
    // Get current settings or create default if none exist
    const currentSettings = await this.getSettings();
    
    if (!currentSettings) {
      return this.createDefaultSettings();
    }
    
    const [updatedSettings] = await db
      .update(settings)
      .set(settingsData)
      .where(eq(settings.id, currentSettings.id))
      .returning();
      
    return updatedSettings;
  }

  private async createDefaultSettings(): Promise<Settings> {
    const defaultSettings = this.getDefaultSettings();
    const [settings] = await db
      .insert(settings)
      .values(defaultSettings)
      .returning();
    return settings;
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
      defaultTimeFormat: "decimal",
      defaultCurrency: "USD",
      displayCurrency: "USD",
      defaultTaxRate: "0",
      enableTax: false,
      showDueDate: true,
    };
  }
}