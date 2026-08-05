ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_version text;
