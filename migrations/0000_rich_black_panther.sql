CREATE TYPE "public"."rounding_type" AS ENUM('none', 'nearest_tenth', 'nearest_quarter', 'nearest_half');--> statement-breakpoint
CREATE TYPE "public"."time_format" AS ENUM('decimal', 'time');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."verification_type" AS ENUM('email', 'email_change', 'password_reset');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"country" text,
	"phone" text,
	"tax_id" text,
	"currency" text DEFAULT 'USD',
	"user_id" integer
);
--> statement-breakpoint
CREATE TABLE "creativity_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"category" text,
	"tags" text,
	"is_pinned" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "focus_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"duration" integer,
	"completed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gratitude_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"client_id" integer NOT NULL,
	"issue_date" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0',
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"total" numeric(10, 2) NOT NULL,
	"notes" text,
	"user_id" integer,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"client_id" integer NOT NULL,
	"description" text,
	"active" boolean DEFAULT true,
	"hourly_rate" numeric(10, 2) DEFAULT '0',
	"color" text DEFAULT '#000000',
	"user_id" integer
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_name" text,
	"business_address" text,
	"business_city" text,
	"business_state" text,
	"business_zip_code" text,
	"business_country" text,
	"business_phone" text,
	"business_email" text,
	"business_tax_id" text,
	"payment_method_type" text DEFAULT 'bank_transfer_us',
	"bank_name" text,
	"bank_account_name" text,
	"bank_account_number" text,
	"bank_sort_code" text,
	"iban" text,
	"swift" text,
	"routing_number" text,
	"paypal_email" text,
	"wise_email" text,
	"other_payment_instructions" text,
	"next_invoice_number" integer DEFAULT 1001,
	"default_time_format" text DEFAULT 'decimal',
	"default_currency" text DEFAULT 'USD',
	"display_currency" text DEFAULT '$',
	"default_tax_rate" numeric(5, 2) DEFAULT '0',
	"enable_tax" boolean DEFAULT false,
	"show_due_date" boolean DEFAULT true,
	"company_logo" text,
	"show_logo" boolean DEFAULT true,
	"logo_size" text DEFAULT '64',
	"show_business_name" boolean DEFAULT true,
	"invoice_color_theme" text DEFAULT '#1f2937',
	"invoice_accent_color" text DEFAULT '#3b82f6',
	"invoice_text_color" text DEFAULT '#374151',
	"invoice_background_color" text DEFAULT '#ffffff',
	"custom_font_size" text DEFAULT '12',
	"invoice_footer_text" text,
	"show_company_details" boolean DEFAULT true,
	"show_hourly_rate" boolean DEFAULT true,
	"show_bank_details" boolean DEFAULT true,
	"show_footer_notes" boolean DEFAULT true,
	"invoice_template" text DEFAULT 'professional',
	"enable_weekly_categorization" boolean DEFAULT true,
	"show_date_column" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"project_id" integer,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration" numeric(10, 6),
	"date" text NOT NULL,
	"week_number" integer NOT NULL,
	"week_label" text NOT NULL,
	"month" text NOT NULL,
	"year" integer NOT NULL,
	"billable" boolean DEFAULT true,
	"invoice_id" integer,
	"user_id" integer
);
--> statement-breakpoint
CREATE TABLE "time_entry_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"time_entry_id" integer NOT NULL,
	"content" text NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"profile_image_url" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"verification_token" text,
	"reset_password_token" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"type" "verification_type" NOT NULL,
	"new_email" varchar(255),
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "weekly_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_completed" boolean DEFAULT false,
	"priority" text,
	"week_of" text NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_notes" ADD CONSTRAINT "time_entry_notes_time_entry_id_time_entries_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_notes" ADD CONSTRAINT "time_entry_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "sessions" USING btree ("user_id");