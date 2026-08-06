import {
  Client, InsertClient, clients,
  Project, InsertProject, projects,
  TimeEntry, InsertTimeEntry, timeEntries,
  TimeEntryNote, InsertTimeEntryNote, timeEntryNotes,
  Invoice, InsertInvoice, invoices,
  Settings, InsertSettings, settings,
  User, InsertUser, users, 
  Verification, verifications,
  ReportFilters, TimeFormat, RoundingType, TimeAdjustment
} from "@shared/schema";
import { formatInvoiceNumber, InvoiceNumberOptions } from "@shared/invoice-number";
import { addWeeks, format, getWeekOfMonth, startOfWeek, endOfWeek, getYear, getMonth } from "date-fns";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleSubject(subject: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Verifications
  createVerification(verification: Omit<Verification, "id">): Promise<Verification>;
  getVerificationByToken(token: string): Promise<Verification | undefined>;
  getVerificationsByUser(userId: number): Promise<Verification[]>;
  deleteVerification(token: string): Promise<void>;

  // Clients
  getClients(): Promise<Client[]>;
  getClientsByUser(userId: number): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProjectsByUser(userId: number): Promise<Project[]>;
  getProjectsByClient(clientId: number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;

  // Time Entries
  getTimeEntries(): Promise<TimeEntry[]>;
  getTimeEntriesByUser(userId: number): Promise<TimeEntry[]>;
  getTimeEntriesByProject(projectId: number): Promise<TimeEntry[]>;
  getTimeEntriesByDateRange(startDate: string, endDate: string): Promise<TimeEntry[]>;
  getTimeEntriesByFilters(filters: ReportFilters): Promise<TimeEntry[]>;
  getTimeEntry(id: number): Promise<TimeEntry | undefined>;
  createTimeEntry(timeEntry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: number, timeEntry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: number): Promise<boolean>;

  // Invoices
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<boolean>;
  getNextInvoiceNumber(userId: number, options?: InvoiceNumberOptions): Promise<string>;

  // Settings
  getSettings(userId: number): Promise<Settings | undefined>;
  updateSettings(userId: number, settings: Partial<InsertSettings>): Promise<Settings>;

  // Time Entry Notes
  getTimeEntryNotes(timeEntryId: number): Promise<TimeEntryNote[]>;
  getAllTimeEntryNotes(userId: number): Promise<TimeEntryNote[]>;
  createTimeEntryNote(note: InsertTimeEntryNote): Promise<TimeEntryNote>;
  updateTimeEntryNote(id: number, note: Partial<InsertTimeEntryNote>): Promise<TimeEntryNote | undefined>;
  deleteTimeEntryNote(id: number): Promise<boolean>;

  // Creativity Features
  getCreativityNotes(userId: number): Promise<any[]>;
  createCreativityNote(note: any): Promise<any>;
  updateCreativityNote(id: number, note: any): Promise<any>;
  deleteCreativityNote(id: number): Promise<void>;
  getWeeklyGoals(userId: number): Promise<any[]>;
  createWeeklyGoal(goal: any): Promise<any>;
  updateWeeklyGoal(id: number, goal: any): Promise<any>;
  deleteWeeklyGoal(id: number): Promise<void>;
}

// This class is no longer used, replaced by DatabaseStorage
export class MemStorage implements Partial<IStorage> {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.usersData.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersData.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.usersData.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async getUserByGoogleSubject(subject: string): Promise<User | undefined> {
    return Array.from(this.usersData.values()).find(
      (user) => user.googleSubject === subject
    );
  }
  
  async getUserByResetToken(token: string): Promise<User | undefined> {
    return Array.from(this.usersData.values()).find(
      (user) => user.resetPasswordToken === token
    );
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userId++;
    const newUser: User = {
      id,
      email: userData.email,
      username: userData.username,
      password: userData.password,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      googleSubject: userData.googleSubject || null,
      invoiceLabelOverrides: userData.invoiceLabelOverrides || null,
      customCurrencyRates: userData.customCurrencyRates || null,
      subscriptionPlan: userData.subscriptionPlan || "free",
      subscriptionStatus: userData.subscriptionStatus || "active",
      subscriptionChangedAt: userData.subscriptionChangedAt || new Date(),
      subscriptionRequestedPlan: userData.subscriptionRequestedPlan || null,
      subscriptionBillingInterval: userData.subscriptionBillingInterval || "monthly",
      subscriptionRequestedBillingInterval: userData.subscriptionRequestedBillingInterval || null,
      subscriptionCurrentPeriodEnd: userData.subscriptionCurrentPeriodEnd || null,
      subscriptionCancelAtPeriodEnd: userData.subscriptionCancelAtPeriodEnd || false,
      paddleCustomerId: userData.paddleCustomerId || null,
      paddleSubscriptionId: userData.paddleSubscriptionId || null,
      termsAcceptedAt: userData.termsAcceptedAt || null,
      termsVersion: userData.termsVersion || null,
      privacyVersion: userData.privacyVersion || null,
      role: userData.role || "user",
      status: userData.status || "pending",
      verificationToken: userData.verificationToken || null,
      resetPasswordToken: userData.resetPasswordToken || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.usersData.set(id, newUser);
    return newUser;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const existingUser = this.usersData.get(id);
    if (!existingUser) return undefined;

    const updatedUser: User = {
      ...existingUser,
      ...userData,
      updatedAt: new Date(),
    };
    this.usersData.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.usersData.delete(id);
  }

  // Verification methods
  async createVerification(verification: Omit<Verification, "id">): Promise<Verification> {
    const id = this.verificationId++;
    const newVerification: Verification = {
      id,
      ...verification,
      createdAt: new Date(),
    };
    this.verificationsData.set(verification.token, newVerification);
    return newVerification;
  }

  async getVerificationByToken(token: string): Promise<Verification | undefined> {
    return this.verificationsData.get(token);
  }

  async deleteVerification(token: string): Promise<void> {
    this.verificationsData.delete(token);
  }
  private clientsData: Map<number, Client>;
  private projectsData: Map<number, Project>;
  private timeEntriesData: Map<number, TimeEntry>;
  private invoicesData: Map<number, Invoice>;
  private settingsData: Settings | undefined;
  private usersData: Map<number, User>;
  private verificationsData: Map<string, Verification>;

  private clientId: number;
  private projectId: number;
  private timeEntryId: number;
  private invoiceId: number;
  private userId: number; 
  private verificationId: number;

  constructor() {
    this.clientsData = new Map();
    this.projectsData = new Map();
    this.timeEntriesData = new Map();
    this.invoicesData = new Map();
    this.usersData = new Map();
    this.verificationsData = new Map();

    this.clientId = 1;
    this.projectId = 1;
    this.timeEntryId = 1;
    this.invoiceId = 1;
    this.userId = 1;
    this.verificationId = 1;

    // Initialize with default settings
    this.settingsData = {
      id: 1,
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
      // Add all missing required fields with null defaults
      invoiceNotes: "Thank you for your business. Payment due within 30 days.",
      invoiceLanguage: "en",
      templateType: null,
      showBusinessLogo: null,
      showClientLogo: null,
      showBankDetails: null,
      showPaymentMethods: null,
      showProjectColumn: null,
      showProjectName: true,
      showInvoiceNotes: true,
      showRateColumn: null,
      showQuantityColumn: null,
      showAmountColumn: null,
      showTaxColumn: null,
      showDescriptionColumn: null,
      showDateColumn: null,
      enableCustomFields: null,
      customField1Name: null,
      customField2Name: null,
      customField3Name: null,
      customField1Value: null,
      customField2Value: null,
      customField3Value: null,
      defaultRoundingType: null,
      paymentMethodType: null,
      bankSortCode: null,
      iban: null,
      swift: null,
      paypalEmail: null,
      stripePublishableKey: null,
      cryptoWalletAddress: null,
      cryptoWalletType: null,
      otherPaymentInstructions: null,
      logoUrl: null,
      primaryColor: null,
      accentColor: null,
      fontFamily: null,
    };

  }

  // Initialize with some sample data
  private seedData(): void {
    // Create a test user
    const testUser: User = {
      id: this.userId++,
      username: "disabled-memory-seed",
      email: "disabled-memory-seed@invalid.local",
      password: "disabled",
      firstName: "Test",
      lastName: "User",
      profileImageUrl: null,
      googleSubject: null,
      invoiceLabelOverrides: null,
      customCurrencyRates: null,
      subscriptionPlan: "free",
      subscriptionStatus: "active",
      subscriptionChangedAt: new Date(),
      subscriptionRequestedPlan: null,
      subscriptionBillingInterval: "monthly",
      subscriptionRequestedBillingInterval: null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionCancelAtPeriodEnd: false,
      paddleCustomerId: null,
      paddleSubscriptionId: null,
      termsAcceptedAt: null,
      termsVersion: null,
      privacyVersion: null,
      role: "admin",
      status: "active",
      verificationToken: null,
      resetPasswordToken: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.usersData.set(testUser.id, testUser);
    
    // Sample clients
    const client1: Client = {
      id: this.clientId++,
      name: "Acme Inc.",
      email: "accounting@acmeinc.com",
      address: "456 Client Avenue",
      city: "Client City",
      state: "ST",
      zipCode: "54321",
      country: "USA",
      phone: "+1 (987) 654-3210",
      taxId: "98-7654321",
      currency: "USD",
      invoiceLanguage: "en",
      invoiceSettings: null,
      userId: 1
    };
    
    const client2: Client = {
      id: this.clientId++,
      name: "TechFirm LLC",
      email: "billing@techfirm.com",
      address: "789 Tech Blvd",
      city: "Tech City",
      state: "ST",
      zipCode: "67890",
      country: "USA",
      phone: "+1 (123) 987-6543",
      taxId: "45-6789012",
      currency: "USD",
      invoiceLanguage: "en",
      invoiceSettings: null,
      userId: 1
    };
    
    const client3: Client = {
      id: this.clientId++,
      name: "Design Studios",
      email: "accounts@designstudios.com",
      address: "321 Design Street",
      city: "Design City",
      state: "ST",
      zipCode: "12345",
      country: "USA",
      phone: "+1 (456) 789-0123",
      taxId: "78-9012345",
      currency: "USD",
      invoiceLanguage: "en",
      invoiceSettings: null,
      userId: 1
    };
    
    this.clientsData.set(client1.id, client1);
    this.clientsData.set(client2.id, client2);
    this.clientsData.set(client3.id, client3);
    
    // Sample projects
    const project1: Project = {
      id: this.projectId++,
      name: "Website Redesign",
      clientId: client1.id,
      description: "Complete website redesign for Acme Inc.",
      active: true,
      hourlyRate: "100",
      color: "#007BFF",
      userId: 1
    };
    
    const project2: Project = {
      id: this.projectId++,
      name: "API Integration",
      clientId: client2.id,
      description: "Integration with third-party APIs for TechFirm LLC",
      active: true,
      hourlyRate: "120",
      color: "#28A745",
      userId: 1
    };
    
    const project3: Project = {
      id: this.projectId++,
      name: "Content Creation",
      clientId: client3.id,
      description: "Blog posts and content writing for Design Studios",
      active: true,
      hourlyRate: "90",
      color: "#FFC107",
      userId: 1
    };
    
    this.projectsData.set(project1.id, project1);
    this.projectsData.set(project2.id, project2);
    this.projectsData.set(project3.id, project3);
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return Array.from(this.clientsData.values());
  }

  async getClient(id: number): Promise<Client | undefined> {
    return this.clientsData.get(id);
  }

  async createClient(client: InsertClient): Promise<Client> {
    const id = this.clientId++;
    const newClient: Client = { 
      id, 
      name: client.name,
      email: client.email || null,
      address: client.address || null,
      city: client.city || null,
      state: client.state || null,
      zipCode: client.zipCode || null,
      country: client.country || null,
      phone: client.phone || null,
      taxId: client.taxId || null,
      currency: client.currency || null,
      color: client.color || "#2563eb",
      invoiceLanguage: client.invoiceLanguage || "en",
      invoiceSettings: client.invoiceSettings || null,
      userId: client.userId || null
    };
    this.clientsData.set(id, newClient);
    return newClient;
  }

  async updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined> {
    const existingClient = this.clientsData.get(id);
    if (!existingClient) return undefined;

    const updatedClient: Client = { 
      ...existingClient, 
      name: client.name ?? existingClient.name,
      email: client.email ?? existingClient.email,
      address: client.address ?? existingClient.address,
      city: client.city ?? existingClient.city,
      state: client.state ?? existingClient.state,
      zipCode: client.zipCode ?? existingClient.zipCode,
      country: client.country ?? existingClient.country,
      phone: client.phone ?? existingClient.phone,
      taxId: client.taxId ?? existingClient.taxId,
      currency: client.currency ?? existingClient.currency,
      invoiceLanguage: client.invoiceLanguage ?? existingClient.invoiceLanguage,
      invoiceSettings: client.invoiceSettings ?? existingClient.invoiceSettings,
      userId: client.userId ?? existingClient.userId
    };
    this.clientsData.set(id, updatedClient);
    return updatedClient;
  }

  async deleteClient(id: number): Promise<boolean> {
    return this.clientsData.delete(id);
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return Array.from(this.projectsData.values());
  }

  async getProjectsByClient(clientId: number): Promise<Project[]> {
    return Array.from(this.projectsData.values()).filter(
      (project) => project.clientId === clientId
    );
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projectsData.get(id);
  }

  async createProject(project: InsertProject): Promise<Project> {
    const id = this.projectId++;
    const newProject: Project = { 
      id, 
      name: project.name,
      clientId: project.clientId,
      description: project.description || null,
      active: project.active || null,
      hourlyRate: project.hourlyRate || null,
      color: project.color || null,
      userId: project.userId || null
    };
    this.projectsData.set(id, newProject);
    return newProject;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const existingProject = this.projectsData.get(id);
    if (!existingProject) return undefined;

    const updatedProject: Project = { 
      ...existingProject, 
      name: project.name ?? existingProject.name,
      clientId: project.clientId ?? existingProject.clientId,
      description: project.description ?? existingProject.description,
      active: project.active ?? existingProject.active,
      hourlyRate: project.hourlyRate ?? existingProject.hourlyRate,
      color: project.color ?? existingProject.color,
      userId: project.userId ?? existingProject.userId
    };
    this.projectsData.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: number): Promise<boolean> {
    return this.projectsData.delete(id);
  }

  // Time Entries
  async getTimeEntries(): Promise<TimeEntry[]> {
    return Array.from(this.timeEntriesData.values());
  }

  async getTimeEntriesByProject(projectId: number): Promise<TimeEntry[]> {
    return Array.from(this.timeEntriesData.values()).filter(
      (entry) => entry.projectId === projectId
    );
  }

  async getTimeEntriesByDateRange(startDate: string, endDate: string): Promise<TimeEntry[]> {
    return Array.from(this.timeEntriesData.values()).filter(
      (entry) => entry.date >= startDate && entry.date <= endDate
    );
  }

  async getTimeEntriesByFilters(filters: ReportFilters): Promise<TimeEntry[]> {
    let entries = Array.from(this.timeEntriesData.values());

    if (filters.clientId) {
      const clientProjects = await this.getProjectsByClient(filters.clientId);
      const projectIds = clientProjects.map(p => p.id);
      entries = entries.filter(entry => entry.projectId && projectIds.includes(entry.projectId));
    }

    if (filters.projectId) {
      entries = entries.filter(entry => entry.projectId === filters.projectId);
    }

    if (filters.startDate && filters.endDate) {
      entries = entries.filter(
        entry => entry.date >= filters.startDate! && entry.date <= filters.endDate!
      );
    }

    return entries;
  }

  async getTimeEntry(id: number): Promise<TimeEntry | undefined> {
    return this.timeEntriesData.get(id);
  }

  async createTimeEntry(timeEntry: InsertTimeEntry): Promise<TimeEntry> {
    const id = this.timeEntryId++;
    const entryDate = new Date(timeEntry.date!);
    const year = getYear(entryDate);
    const month = format(entryDate, 'yyyy-MM');
    const weekOfMonth = getWeekOfMonth(entryDate);
    
    const weekStart = format(startOfWeek(entryDate), 'MMM d');
    const weekEnd = format(endOfWeek(entryDate), 'MMM d');
    const weekLabel = `Week ${weekOfMonth} (${weekStart} - ${weekEnd})`;
    
    const newEntry: TimeEntry = { 
      id, 
      description: timeEntry.description!,
      projectId: timeEntry.projectId || null,
      clientId: timeEntry.clientId || null,
      startTime: timeEntry.startTime!,
      endTime: timeEntry.endTime || null,
      duration: timeEntry.duration || null,
      date: timeEntry.date!,
      weekNumber: weekOfMonth,
      weekLabel,
      month,
      year,
      billable: timeEntry.billable || null,
      invoiceId: null,
      userId: timeEntry.userId || null
    };
    
    this.timeEntriesData.set(id, newEntry);
    return newEntry;
  }

  async updateTimeEntry(id: number, timeEntry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const existingEntry = this.timeEntriesData.get(id);
    if (!existingEntry) return undefined;

    // If date changed, recalculate week number and label
    let weekNumber = existingEntry.weekNumber;
    let weekLabel = existingEntry.weekLabel;
    let month = existingEntry.month;
    let year = existingEntry.year;
    
    if (timeEntry.date && timeEntry.date !== existingEntry.date) {
      const entryDate = new Date(timeEntry.date);
      weekNumber = getWeekOfMonth(entryDate);
      const weekStart = format(startOfWeek(entryDate), 'MMM d');
      const weekEnd = format(endOfWeek(entryDate), 'MMM d');
      weekLabel = `Week ${weekNumber} (${weekStart} - ${weekEnd})`;
      month = format(entryDate, 'yyyy-MM');
      year = getYear(entryDate);
    }

    const updatedEntry = { 
      ...existingEntry, 
      ...timeEntry,
      weekNumber,
      weekLabel,
      month,
      year
    };
    
    this.timeEntriesData.set(id, updatedEntry);
    return updatedEntry;
  }

  async deleteTimeEntry(id: number): Promise<boolean> {
    return this.timeEntriesData.delete(id);
  }

  // Invoices
  async getInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoicesData.values());
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    return this.invoicesData.get(id);
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined> {
    return Array.from(this.invoicesData.values()).find(
      (invoice) => invoice.invoiceNumber === invoiceNumber
    );
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const id = this.invoiceId++;
    const newInvoice: Invoice = { 
      id, 
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status || "draft",
      subtotal: invoice.subtotal,
      tax: invoice.tax || null,
      taxRate: invoice.taxRate || null,
      total: invoice.total,
      notes: invoice.notes || null,
      userId: invoice.userId || null
    };
    this.invoicesData.set(id, newInvoice);

    // Update the next invoice number in settings
    if (this.settingsData) {
      this.settingsData = {
        ...this.settingsData,
        nextInvoiceNumber: this.settingsData.nextInvoiceNumber + 1
      };
    }

    return newInvoice;
  }

  async updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const existingInvoice = this.invoicesData.get(id);
    if (!existingInvoice) return undefined;

    const updatedInvoice = { ...existingInvoice, ...invoice };
    this.invoicesData.set(id, updatedInvoice);
    return updatedInvoice;
  }

  async deleteInvoice(id: number): Promise<boolean> {
    return this.invoicesData.delete(id);
  }

  async getNextInvoiceNumber(_userId: number, options: InvoiceNumberOptions = {}): Promise<string> {
    if (!this.settingsData) {
      return formatInvoiceNumber(1001, options);
    }
    
    const nextNumber = this.settingsData.nextInvoiceNumber;
    return formatInvoiceNumber(nextNumber, {
      prefix: options.prefix ?? (this.settingsData as any).invoiceNumberPrefix ?? "INV-",
      suffix: options.suffix ?? (this.settingsData as any).invoiceNumberSuffix ?? "",
      padding: options.padding ?? (this.settingsData as any).invoiceNumberPadding ?? 4,
    });
  }

  // Settings
  async getSettings(_userId: number): Promise<Settings | undefined> {
    return this.settingsData;
  }

  async updateSettings(_userId: number, newSettings: Partial<InsertSettings>): Promise<Settings> {
    this.settingsData = {
      ...this.settingsData!,
      ...newSettings
    };
    return this.settingsData;
  }
}

import { DatabaseStorage } from './database-storage';

// Use database storage instead of memory storage
// Use database storage to keep existing time entries
export const storage = new DatabaseStorage();
