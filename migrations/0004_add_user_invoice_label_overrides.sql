ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invoice_label_overrides" text;
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "invoice_language" text DEFAULT 'en';
--> statement-breakpoint
UPDATE "settings" SET "invoice_language" = COALESCE("invoice_language", 'en');
