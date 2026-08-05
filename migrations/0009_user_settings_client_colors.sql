ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "color" text DEFAULT '#2563eb';

ALTER TABLE "settings"
  ADD COLUMN IF NOT EXISTS "user_id" integer,
  ADD COLUMN IF NOT EXISTS "default_due_date_mode" text DEFAULT 'calendar_month',
  ADD COLUMN IF NOT EXISTS "default_due_days" integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "show_payment_terms" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "payment_terms" text;

UPDATE "settings"
SET "user_id" = COALESCE(
  (SELECT "id" FROM "users" WHERE lower("email") = 'erdegovic@gmail.com' LIMIT 1),
  (SELECT min("id") FROM "users")
)
WHERE "user_id" IS NULL;

DELETE FROM "settings" newer
USING "settings" older
WHERE newer."user_id" = older."user_id"
  AND newer."id" > older."id";

CREATE UNIQUE INDEX IF NOT EXISTS "settings_user_id_unique"
  ON "settings" ("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settings_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "settings"
      ADD CONSTRAINT "settings_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE "settings" ALTER COLUMN "user_id" SET NOT NULL;

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_invoice_number_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_user_invoice_number_unique"
  ON "invoices" ("user_id", "invoice_number");
