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
  getInvoiceByNumber(userId: number, invoiceNumber: string): Promise<Invoice | undefined>;
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


// The in-memory MemStorage implementation that used to live here was removed.
// Nothing constructed it — `storage` below has been a DatabaseStorage for a long
// time — and its object literals had drifted several schema migrations behind
// (missing aiEnabled, aiDataConsentAt, client color/aiPreferences, invoice
// lineItems), which accounted for 9 of the repository's TypeScript errors.

import { DatabaseStorage } from './database-storage';

// Use database storage instead of memory storage
// Use database storage to keep existing time entries
export const storage = new DatabaseStorage();
