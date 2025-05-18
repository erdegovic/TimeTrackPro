import { and, eq, gte, lte, desc, asc } from 'drizzle-orm';
import { db } from './db';
import {
  Client, InsertClient, clients,
  Project, InsertProject, projects,
  TimeEntry, InsertTimeEntry, timeEntries,
  Invoice, InsertInvoice, invoices,
  Settings, InsertSettings, settings,
  ReportFilters
} from "@shared/schema";
import { addWeeks, format, getWeekOfMonth, startOfWeek, endOfWeek, parseISO, getYear } from "date-fns";
import { IStorage } from './storage';

export class DatabaseStorage implements IStorage {
  // Clients
  async getClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(clients.name);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
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
    const [deletedClient] = await db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning({ id: clients.id });
    return !!deletedClient;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(projects.name);
  }

  async getProjectsByClient(clientId: number): Promise<Project[]> {
    return db
      .select()
      .from(projects)
      .where(eq(projects.clientId, clientId))
      .orderBy(projects.name);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const [updatedProject] = await db
      .update(projects)
      .set(project)
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }

  async deleteProject(id: number): Promise<boolean> {
    const [deletedProject] = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    return !!deletedProject;
  }

  // Time Entries
  async getTimeEntries(): Promise<TimeEntry[]> {
    return db
      .select()
      .from(timeEntries)
      .orderBy(desc(timeEntries.date), desc(timeEntries.startTime));
  }

  async getTimeEntriesByProject(projectId: number): Promise<TimeEntry[]> {
    return db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.projectId, projectId))
      .orderBy(desc(timeEntries.date), desc(timeEntries.startTime));
  }

  async getTimeEntriesByDateRange(startDate: string, endDate: string): Promise<TimeEntry[]> {
    return db
      .select()
      .from(timeEntries)
      .where(
        and(
          gte(timeEntries.date, startDate),
          lte(timeEntries.date, endDate)
        )
      )
      .orderBy(asc(timeEntries.date), asc(timeEntries.startTime));
  }

  async getTimeEntriesByFilters(filters: ReportFilters): Promise<TimeEntry[]> {
    const conditions = [];
    
    // Add date range if provided
    if (filters.startDate && filters.endDate) {
      conditions.push(
        and(
          gte(timeEntries.date, filters.startDate),
          lte(timeEntries.date, filters.endDate)
        )
      );
    }
    
    // Add project filter if provided
    if (filters.projectId) {
      conditions.push(eq(timeEntries.projectId, filters.projectId));
    } else if (filters.clientId) {
      // If client filter provided but not project filter, get entries for all client's projects
      const clientProjects = await this.getProjectsByClient(filters.clientId);
      const projectIds = clientProjects.map(p => p.id);
      
      // Only add condition if the client has projects
      if (projectIds.length > 0) {
        // Unfortunately, drizzle-orm doesn't have a simple "in" operator for numeric arrays
        // so we need to construct it manually with OR conditions
        const projectConditions = projectIds.map(id => eq(timeEntries.projectId, id));
        if (projectConditions.length === 1) {
          conditions.push(projectConditions[0]);
        } else if (projectConditions.length > 1) {
          // or(...projectConditions) would be ideal but we need to manually implement this
          // For now, we'll query without this filter and filter in memory
          // (This is sub-optimal but works for the demo)
        }
      }
    }
    
    // Combine conditions if there are any
    let query = db.select().from(timeEntries);
    if (conditions.length === 1) {
      query = query.where(conditions[0]);
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions));
    }
    
    // Get entries
    let entries = await query.orderBy(asc(timeEntries.date), asc(timeEntries.startTime));
    
    // Additional client filter if we couldn't do it in the query
    if (filters.clientId && !filters.projectId) {
      const clientProjects = await this.getProjectsByClient(filters.clientId);
      const projectIds = clientProjects.map(p => p.id);
      entries = entries.filter(entry => projectIds.includes(entry.projectId));
    }
    
    return entries;
  }

  async getTimeEntry(id: number): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    return entry;
  }

  async createTimeEntry(timeEntryData: InsertTimeEntry): Promise<TimeEntry> {
    // Create a properly typed entry with all required fields and defaults for optional ones
    const entryDate = parseISO(timeEntryData.date);
    const year = getYear(entryDate);
    const month = format(entryDate, 'MMM'); // Just the month name
    const weekOfMonth = getWeekOfMonth(entryDate);
    
    const weekStart = format(startOfWeek(entryDate), 'MMM d');
    const weekEnd = format(endOfWeek(entryDate), 'MMM d');
    const weekLabel = `Week ${weekOfMonth} (${weekStart} - ${weekEnd})`;
    
    // FIXED: Always ensure duration is at least 0.01 hours
    let duration = "0.01"; // Minimum duration to display
    
    // If client sent a duration, use it as long as it's not 0
    if (timeEntryData.duration && parseFloat(timeEntryData.duration) > 0) {
      duration = timeEntryData.duration;
    } 
    // If we have start/end times, calculate duration (but keep minimum)
    else if (timeEntryData.startTime && timeEntryData.endTime) {
      const diffMs = timeEntryData.endTime.getTime() - timeEntryData.startTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      // Only override minimum if calculated value is larger
      if (diffHours > 0.01) {
        duration = diffHours.toFixed(2);
      }
    }
    
    console.log(`Database using duration: ${duration} hours (enforcing minimum value)`);
    
    
    const billable = timeEntryData.billable !== undefined ? timeEntryData.billable : true;
    
    console.log("Creating time entry with data:", {
      description: timeEntryData.description,
      projectId: timeEntryData.projectId,
      startTime: timeEntryData.startTime,
      endTime: timeEntryData.endTime,
      duration,
      date: timeEntryData.date,
      weekNumber: weekOfMonth,
      weekLabel,
      month,
      year,
      billable,
      invoiceId: null
    });
    
    try {
      // Insert the properly structured entry
      const [newEntry] = await db.insert(timeEntries).values({
        description: timeEntryData.description,
        projectId: timeEntryData.projectId,
        startTime: timeEntryData.startTime,
        endTime: timeEntryData.endTime,
        duration,
        date: timeEntryData.date,
        weekNumber: weekOfMonth,
        weekLabel,
        month,
        year,
        billable,
        invoiceId: null
      }).returning();
      
      console.log("Successfully created time entry:", newEntry);
      return newEntry;
    } catch (error) {
      console.error("Database error creating time entry:", error);
      throw error;
    }
  }

  async updateTimeEntry(id: number, timeEntryData: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    // If date is updated, recalculate week-related fields
    let updateData: Record<string, any> = { ...timeEntryData };
    
    if (timeEntryData.date) {
      const entryDate = parseISO(timeEntryData.date);
      const year = getYear(entryDate);
      const month = format(entryDate, 'yyyy-MM');
      const weekOfMonth = getWeekOfMonth(entryDate);
      
      const weekStart = format(startOfWeek(entryDate), 'MMM d');
      const weekEnd = format(endOfWeek(entryDate), 'MMM d');
      const weekLabel = `Week ${weekOfMonth} (${weekStart} - ${weekEnd})`;
      
      updateData = {
        ...updateData,
        weekNumber: weekOfMonth,
        weekLabel,
        month,
        year,
      };
    }
    
    const [updatedEntry] = await db
      .update(timeEntries)
      .set(updateData)
      .where(eq(timeEntries.id, id))
      .returning();
    
    return updatedEntry;
  }

  async deleteTimeEntry(id: number): Promise<boolean> {
    const [deletedEntry] = await db
      .delete(timeEntries)
      .where(eq(timeEntries.id, id))
      .returning({ id: timeEntries.id });
    return !!deletedEntry;
  }

  // Invoices
  async getInvoices(): Promise<Invoice[]> {
    return db
      .select()
      .from(invoices)
      .orderBy(desc(invoices.issueDate));
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
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
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    
    // Update the next invoice number in settings
    const settingsData = await this.getSettings();
    if (settingsData) {
      await this.updateSettings({
        nextInvoiceNumber: settingsData.nextInvoiceNumber + 1
      });
    }
    
    return newInvoice;
  }

  async updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updatedInvoice] = await db
      .update(invoices)
      .set(invoice)
      .where(eq(invoices.id, id))
      .returning();
    return updatedInvoice;
  }

  async deleteInvoice(id: number): Promise<boolean> {
    // First, remove invoice ID from associated time entries
    await db
      .update(timeEntries)
      .set({ invoiceId: null })
      .where(eq(timeEntries.invoiceId, id));
    
    const [deletedInvoice] = await db
      .delete(invoices)
      .where(eq(invoices.id, id))
      .returning({ id: invoices.id });
    return !!deletedInvoice;
  }

  async getNextInvoiceNumber(): Promise<string> {
    const settingsData = await this.getSettings();
    if (!settingsData) {
      return "INV-1001";
    }
    
    const nextNumber = settingsData.nextInvoiceNumber;
    return `INV-${nextNumber}`;
  }

  // Settings
  async getSettings(): Promise<Settings | undefined> {
    const [settingsData] = await db.select().from(settings);
    
    // If no settings exist, create default settings
    if (!settingsData) {
      return this.createDefaultSettings();
    }
    
    return settingsData;
  }

  async updateSettings(settingsData: Partial<InsertSettings>): Promise<Settings> {
    // Get existing settings or create default
    const existingSettings = await this.getSettings();
    
    if (!existingSettings) {
      // Create with new data
      const defaultSettings = this.getDefaultSettings();
      const newSettings = { ...defaultSettings, ...settingsData };
      const [createdSettings] = await db.insert(settings).values(newSettings).returning();
      return createdSettings;
    }
    
    // Update existing settings
    const [updatedSettings] = await db
      .update(settings)
      .set(settingsData)
      .where(eq(settings.id, existingSettings.id))
      .returning();
    
    return updatedSettings;
  }
  
  // Helper to create default settings if none exist
  private async createDefaultSettings(): Promise<Settings> {
    const defaultSettings = this.getDefaultSettings();
    const [createdSettings] = await db.insert(settings).values(defaultSettings).returning();
    return createdSettings;
  }
  
  // Default settings
  private getDefaultSettings(): InsertSettings {
    return {
      businessName: "Your Business Name",
      businessAddress: "123 Your Street",
      businessCity: "Your City",
      businessState: "ST",
      businessZipCode: "12345",
      businessCountry: "USA",
      businessPhone: "+1 (123) 456-7890",
      businessEmail: "your.email@example.com",
      businessTaxId: "12-3456789",
      bankName: "First National Bank",
      bankAccountName: "Your Business Name",
      bankAccountNumber: "XXXX-XXXX-1234",
      nextInvoiceNumber: 1001,
      defaultTimeFormat: "decimal",
      defaultCurrency: "USD",
    };
  }
}