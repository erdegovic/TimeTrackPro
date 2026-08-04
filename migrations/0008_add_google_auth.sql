ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_subject" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_subject_unique" ON "users" ("google_subject");
