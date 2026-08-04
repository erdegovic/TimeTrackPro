ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "invoice_language" text DEFAULT 'en';
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "invoice_settings" text;
--> statement-breakpoint
UPDATE "clients" SET "invoice_language" = COALESCE("invoice_language", 'en');
