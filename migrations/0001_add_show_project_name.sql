ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "show_project_name" boolean DEFAULT true;
--> statement-breakpoint
UPDATE "settings" SET "show_project_name" = true WHERE "show_project_name" IS NULL;
