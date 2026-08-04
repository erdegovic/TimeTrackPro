ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "invoice_notes" text;
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "show_invoice_notes" boolean DEFAULT true;
--> statement-breakpoint
UPDATE "settings"
SET
  "invoice_notes" = COALESCE("invoice_notes", 'Thank you for your business. Payment due within 30 days.'),
  "show_invoice_notes" = COALESCE("show_invoice_notes", true);
