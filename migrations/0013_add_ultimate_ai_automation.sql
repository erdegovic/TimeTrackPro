ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_data_consent_at timestamp;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS ai_preferences text;

CREATE TABLE IF NOT EXISTS ai_artifacts (
  id text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id integer REFERENCES clients(id) ON DELETE SET NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  source_hash text NOT NULL,
  input_meta text,
  result text NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  approved_at timestamp
);
CREATE INDEX IF NOT EXISTS ai_artifacts_user_created_idx ON ai_artifacts(user_id, created_at);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL,
  action_units integer NOT NULL DEFAULT 1,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_micros integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_idx ON ai_usage_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS recurring_invoice_schedules (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  frequency text NOT NULL DEFAULT 'monthly',
  billing_day integer NOT NULL DEFAULT 1,
  send_hour integer NOT NULL DEFAULT 9,
  timezone text NOT NULL DEFAULT 'UTC',
  period_mode text NOT NULL DEFAULT 'previous_month',
  require_approval boolean NOT NULL DEFAULT true,
  cancellation_window_minutes integer NOT NULL DEFAULT 60,
  next_run_at timestamp NOT NULL,
  last_run_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recurring_invoice_schedules_user_idx ON recurring_invoice_schedules(user_id);
CREATE INDEX IF NOT EXISTS recurring_invoice_schedules_due_idx ON recurring_invoice_schedules(enabled, next_run_at);

CREATE TABLE IF NOT EXISTS invoice_automation_jobs (
  id text PRIMARY KEY,
  schedule_id integer REFERENCES recurring_invoice_schedules(id) ON DELETE SET NULL,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_id integer REFERENCES invoices(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'preparing',
  period_start text NOT NULL,
  period_end text NOT NULL,
  payload text NOT NULL,
  validation text NOT NULL,
  email_subject text,
  email_body text,
  send_at timestamp,
  sent_at timestamp,
  cancelled_at timestamp,
  error_message text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_automation_jobs_user_created_idx ON invoice_automation_jobs(user_id, created_at);
CREATE INDEX IF NOT EXISTS invoice_automation_jobs_status_send_idx ON invoice_automation_jobs(status, send_at);

CREATE TABLE IF NOT EXISTS invoice_automation_audit (
  id serial PRIMARY KEY,
  job_id text NOT NULL REFERENCES invoice_automation_jobs(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_automation_audit_job_created_idx ON invoice_automation_audit(job_id, created_at);
