ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "invoice_number_prefix" text DEFAULT 'INV-';
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "invoice_number_suffix" text DEFAULT '';
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "invoice_number_padding" integer DEFAULT 4;
--> statement-breakpoint
UPDATE "settings"
SET
  "invoice_number_prefix" = COALESCE("invoice_number_prefix", 'INV-'),
  "invoice_number_suffix" = COALESCE("invoice_number_suffix", ''),
  "invoice_number_padding" = COALESCE("invoice_number_padding", 4);
