import { pgTable, text, serial, integer, numeric, boolean, timestamp, pgEnum, varchar, index, uniqueIndex, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define enums
export const timeFormatEnum = pgEnum('time_format', ['decimal', 'time']);
export const roundingTypeEnum = pgEnum('rounding_type', ['none', 'nearest_tenth', 'nearest_quarter', 'nearest_half']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);
export const userStatusEnum = pgEnum('user_status', ['pending', 'active', 'inactive']);
export const verificationTypeEnum = pgEnum('verification_type', ['email', 'email_change', 'password_reset']);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  googleSubject: text("google_subject").unique(),
  invoiceLabelOverrides: text("invoice_label_overrides"),
  customCurrencyRates: text("custom_currency_rates"),
  subscriptionPlan: text("subscription_plan").notNull().default("free"),
  subscriptionStatus: text("subscription_status").notNull().default("active"),
  subscriptionChangedAt: timestamp("subscription_changed_at").defaultNow(),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  termsVersion: text("terms_version"),
  privacyVersion: text("privacy_version"),
  role: userRoleEnum("role").notNull().default("user"),
  status: userStatusEnum("status").notNull().default("pending"),
  verificationToken: text("verification_token"),
  resetPasswordToken: text("reset_password_token"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email verifications table
export const verifications = pgTable("verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text("token").notNull(),
  type: verificationTypeEnum("type").notNull(),
  newEmail: varchar("new_email", { length: 255 }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sessions table for user authentication
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    userIdx: index("session_user_idx").on(table.userId),
  }
});

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
  currency: text("currency").default("USD"),
  color: text("color").default("#2563eb"),
  invoiceLanguage: text("invoice_language").default("en"),
  invoiceSettings: text("invoice_settings"),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  issueDate: text("issue_date").notNull(), // Store as YYYY-MM-DD
  dueDate: text("due_date").notNull(), // Store as YYYY-MM-DD
  status: text("status").notNull().default("draft"), // draft, sent, paid
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 10, scale: 2 }).default("0"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  lineItems: text("line_items"), // JSON string of custom/additional line items
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }),
}, (table) => ({
  userInvoiceNumberIdx: uniqueIndex("invoices_user_invoice_number_unique").on(table.userId, table.invoiceNumber),
}));

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  description: text("description"),
  active: boolean("active").default(true),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).default("0"),
  color: text("color").default("#000000"), // Default to black
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }),
});

// Time entries table
export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: 'cascade' }),
  clientId: integer("client_id").references(() => clients.id, { onDelete: 'cascade' }), // Direct client reference for entries without projects
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: numeric("duration", { precision: 10, scale: 6 }), // Duration in hours with second precision
  date: text("date").notNull(), // Store as YYYY-MM-DD
  weekNumber: integer("week_number").notNull(),
  weekLabel: text("week_label").notNull(), // e.g., "Week 1 (Jul 3 - Jul 9)"
  month: text("month").notNull(), // Store as YYYY-MM
  year: integer("year").notNull(),
  billable: boolean("billable").default(true),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: 'set null' }),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }),
});

// Time entry notes table
export const timeEntryNotes = pgTable("time_entry_notes", {
  id: serial("id").primaryKey(),
  timeEntryId: integer("time_entry_id").notNull().references(() => timeEntries.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Settings table
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  businessName: text("business_name"),
  businessAddress: text("business_address"),
  businessCity: text("business_city"),
  businessState: text("business_state"),
  businessZipCode: text("business_zip_code"),
  businessCountry: text("business_country"),
  businessPhone: text("business_phone"),
  businessEmail: text("business_email"),
  businessTaxId: text("business_tax_id"),
  
  // Payment Details - Dynamic based on method type
  paymentMethodType: text("payment_method_type").default("bank_transfer_us"),
  bankName: text("bank_name"),
  bankAccountName: text("bank_account_name"),
  bankAccountNumber: text("bank_account_number"),
  bankSortCode: text("bank_sort_code"),
  iban: text("iban"),
  swift: text("swift"),
  routingNumber: text("routing_number"),
  paypalEmail: text("paypal_email"),
  wiseEmail: text("wise_email"),
  otherPaymentInstructions: text("other_payment_instructions"),
  nextInvoiceNumber: integer("next_invoice_number").default(1001),
  invoiceNumberPrefix: text("invoice_number_prefix").default("INV-"),
  invoiceNumberSuffix: text("invoice_number_suffix").default(""),
  invoiceNumberPadding: integer("invoice_number_padding").default(4),
  defaultTimeFormat: text("default_time_format").default("decimal"),
  defaultCurrency: text("default_currency").default("USD"),
  displayCurrency: text("display_currency").default("$"),
  defaultTaxRate: numeric("default_tax_rate", { precision: 5, scale: 2 }).default("0"),
  enableTax: boolean("enable_tax").default(false),
  showDueDate: boolean("show_due_date").default(true),
  defaultDueDateMode: text("default_due_date_mode").default("calendar_month"),
  defaultDueDays: integer("default_due_days").default(30),
  showPaymentTerms: boolean("show_payment_terms").default(false),
  paymentTerms: text("payment_terms"),
  
  // Invoice customization fields
  companyLogo: text("company_logo"), // Base64 encoded image
  showLogo: boolean("show_logo").default(true),
  logoSize: text("logo_size").default("64"), // Logo height in pixels
  showBusinessName: boolean("show_business_name").default(true),
  invoiceColorTheme: text("invoice_color_theme").default("#1f2937"), // Primary color
  invoiceAccentColor: text("invoice_accent_color").default("#3b82f6"), // Accent color
  invoiceTextColor: text("invoice_text_color").default("#374151"), // Text color
  invoiceBackgroundColor: text("invoice_background_color").default("#ffffff"), // Background
  
  // Additional invoice customization
  customFontSize: text("custom_font_size").default("12"), // Font size in px
  invoiceNotes: text("invoice_notes"),
  invoiceFooterText: text("invoice_footer_text"),
  showCompanyDetails: boolean("show_company_details").default(true),
  showInvoiceNotes: boolean("show_invoice_notes").default(true),
  showHourlyRate: boolean("show_hourly_rate").default(true), // Show/hide hourly rate column
  showProjectName: boolean("show_project_name").default(true), // Show/hide project name under invoice line item descriptions
  showBankDetails: boolean("show_bank_details").default(true),
  showFooterNotes: boolean("show_footer_notes").default(true),
  invoiceTemplate: text("invoice_template").default("professional"), // Template style
  invoiceLanguage: text("invoice_language").default("en"),
  
  // Report settings
  enableWeeklyCategorization: boolean("enable_weekly_categorization").default(true),
  showDateColumn: boolean("show_date_column").default(true),
});

// Creativity Features Tables
export const creativityNotes = pgTable("creativity_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  category: text("category"), // Ideas, Goals, Inspirations, Meeting Notes
  tags: text("tags"), // Comma-separated tags
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const weeklyGoals = pgTable("weekly_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  isCompleted: boolean("is_completed").default(false),
  priority: text("priority"), // high, medium, low
  weekOf: text("week_of").notNull(), // Start of the week (YYYY-MM-DD)
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const gratitudeEntries = pgTable("gratitude_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  createdAt: timestamp("created_at").defaultNow(),
});

export const focusSessions = pgTable("focus_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // meditation, breathing, focus
  duration: integer("duration"), // in seconds
  completedAt: timestamp("completed_at").defaultNow(),
});

// Encrypted account snapshot metadata. Snapshot contents live in private object
// storage; this table intentionally contains recovery metadata only.
export const accountSnapshots = pgTable("account_snapshots", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull(),
  objectKey: text("object_key").notNull().unique(),
  reason: text("reason").notNull().default("scheduled"),
  status: text("status").notNull().default("pending"),
  schemaVersion: integer("schema_version").notNull().default(1),
  byteSize: integer("byte_size"),
  checksum: text("checksum"),
  recordCounts: text("record_counts"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  userCreatedIdx: index("account_snapshots_user_created_idx").on(table.userId, table.createdAt),
  statusCreatedIdx: index("account_snapshots_status_created_idx").on(table.status, table.createdAt),
}));

export const backupAuditEvents = pgTable("backup_audit_events", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").references(() => users.id, { onDelete: "set null" }),
  targetUserId: integer("target_user_id").notNull(),
  snapshotId: text("snapshot_id"),
  action: text("action").notNull(),
  status: text("status").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  targetCreatedIdx: index("backup_audit_events_target_created_idx").on(table.targetUserId, table.createdAt),
}));

// Create Insert Schemas
export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertTimeEntrySchema = createInsertSchema(timeEntries)
  .omit({ id: true, invoiceId: true })
  .partial();
export const insertTimeEntryNoteSchema = createInsertSchema(timeEntryNotes).omit({ id: true, createdAt: true, updatedAt: true });

// Create a more flexible schema specifically for updates
export const timeEntryUpdateSchema = z.object({
  description: z.string().optional(),
  projectId: z.coerce.number().nullable().optional(),
  clientId: z.coerce.number().nullable().optional(),
  startTime: z.string().optional(),    // Add startTime to schema
  endTime: z.string().optional(),      // Add endTime to schema
  duration: z.string().optional(),
  amount: z.string().optional(),      // Add amount to schema
  hourlyRate: z.string().optional(),  // Add hourly rate to schema
  date: z.string().optional(),
  month: z.string().optional(),
  year: z.number().optional(),
  weekNumber: z.number().optional(),
  weekLabel: z.string().optional(),
  billable: z.boolean().optional(),
});
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true, userId: true });

// Creativity Features Insert Schemas
export const insertCreativityNoteSchema = createInsertSchema(creativityNotes).omit({ id: true });
export const insertWeeklyGoalSchema = createInsertSchema(weeklyGoals).omit({ id: true });
export const insertGratitudeEntrySchema = createInsertSchema(gratitudeEntries).omit({ id: true });
export const insertFocusSessionSchema = createInsertSchema(focusSessions).omit({ id: true });

// Define Types
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;

export type TimeEntryNote = typeof timeEntryNotes.$inferSelect;
export type InsertTimeEntryNote = z.infer<typeof insertTimeEntryNoteSchema>;

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
  excludeInvoiced?: boolean;
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

// User related types
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const userLoginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const userRegisterSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  captchaToken: z.string().min(1, "Please complete the captcha"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserRegister = z.infer<typeof userRegisterSchema>;
export type UserLogin = z.infer<typeof userLoginSchema>;
export type Verification = typeof verifications.$inferSelect;
export const insertVerificationSchema = createInsertSchema(verifications).omit({ id: true });
export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type Session = typeof sessions.$inferSelect;

// Creativity Features Types
export type CreativityNote = typeof creativityNotes.$inferSelect;
export type InsertCreativityNote = z.infer<typeof insertCreativityNoteSchema>;
export type WeeklyGoal = typeof weeklyGoals.$inferSelect;
export type InsertWeeklyGoal = z.infer<typeof insertWeeklyGoalSchema>;
export type GratitudeEntry = typeof gratitudeEntries.$inferSelect;
export type InsertGratitudeEntry = z.infer<typeof insertGratitudeEntrySchema>;
export type FocusSession = typeof focusSessions.$inferSelect;
export type InsertFocusSession = z.infer<typeof insertFocusSessionSchema>;
