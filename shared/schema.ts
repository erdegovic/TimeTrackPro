import { pgTable, text, serial, integer, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define enums
export const timeFormatEnum = pgEnum('time_format', ['decimal', 'time']);
export const roundingTypeEnum = pgEnum('rounding_type', ['none', 'nearest_tenth', 'nearest_quarter', 'nearest_half']);

// Clients table
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  phone: text("phone"),
  taxId: text("tax_id"),
});

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  clientId: integer("client_id").notNull(),
  description: text("description"),
  active: boolean("active").default(true),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).default("0"),
});

// Time entries table
export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  projectId: integer("project_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: numeric("duration", { precision: 10, scale: 2 }), // Duration in hours
  date: text("date").notNull(), // Store as YYYY-MM-DD
  weekNumber: integer("week_number").notNull(),
  weekLabel: text("week_label").notNull(), // e.g., "Week 1 (Jul 3 - Jul 9)"
  month: text("month").notNull(), // Store as YYYY-MM
  year: integer("year").notNull(),
  billable: boolean("billable").default(true),
  invoiceId: integer("invoice_id"),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  clientId: integer("client_id").notNull(),
  issueDate: text("issue_date").notNull(), // Store as YYYY-MM-DD
  dueDate: text("due_date").notNull(), // Store as YYYY-MM-DD
  status: text("status").notNull().default("draft"), // draft, sent, paid
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 10, scale: 2 }).default("0"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
});

// Settings table
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  businessName: text("business_name"),
  businessAddress: text("business_address"),
  businessCity: text("business_city"),
  businessState: text("business_state"),
  businessZipCode: text("business_zip_code"),
  businessCountry: text("business_country"),
  businessPhone: text("business_phone"),
  businessEmail: text("business_email"),
  businessTaxId: text("business_tax_id"),
  bankName: text("bank_name"),
  bankAccountName: text("bank_account_name"),
  bankAccountNumber: text("bank_account_number"),
  nextInvoiceNumber: integer("next_invoice_number").default(1001),
  defaultTimeFormat: text("default_time_format").default("decimal"),
  defaultCurrency: text("default_currency").default("USD"),
});

// Create Insert Schemas
export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true, invoiceId: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });

// Define Types
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

// Additional Types for UI
export type TimeFormat = "decimal" | "time";
export type RoundingType = "none" | "nearest_tenth" | "nearest_quarter" | "nearest_half";

export type TimeAdjustment = {
  increaseByPercentage: boolean;
  percentage: number;
  roundToNearestTenth: boolean;
};

export type ReportFilters = {
  clientId?: number;
  projectId?: number;
  startDate?: string;
  endDate?: string;
  timeFormat: TimeFormat;
  roundingType: RoundingType;
  timeAdjustment?: TimeAdjustment;
};

export type InvoiceTemplate = {
  id: number;
  name: string;
  includeWeeks: boolean;
  includeTax: boolean;
  includeNotes: boolean;
  defaultNotes: string;
  defaultDueDays: number;
};
