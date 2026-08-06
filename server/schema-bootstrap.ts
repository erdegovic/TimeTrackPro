import { pool } from "./db";

/**
 * Applies the small, additive production migration before the API starts.
 * Hostinger deploys the built server directly, so there is no separate migration
 * runner in that environment yet.
 */
export async function ensureCurrentSchema() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS subscription_changed_at timestamp DEFAULT now(),
        ADD COLUMN IF NOT EXISTS subscription_requested_plan text,
        ADD COLUMN IF NOT EXISTS subscription_billing_interval text NOT NULL DEFAULT 'monthly',
        ADD COLUMN IF NOT EXISTS subscription_requested_billing_interval text,
        ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamp,
        ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS paddle_customer_id text,
        ADD COLUMN IF NOT EXISTS paddle_subscription_id text,
        ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp,
        ADD COLUMN IF NOT EXISTS terms_version text,
        ADD COLUMN IF NOT EXISTS privacy_version text,
        ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS ai_data_consent_at timestamp
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_paddle_customer_id_unique ON users (paddle_customer_id) WHERE paddle_customer_id IS NOT NULL`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_paddle_subscription_id_unique ON users (paddle_subscription_id) WHERE paddle_subscription_id IS NOT NULL`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS paddle_webhook_events (
        id text PRIMARY KEY,
        event_type text NOT NULL,
        occurred_at timestamp NOT NULL,
        processed_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS paddle_checkout_sessions (
        token text PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamp NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS paddle_checkout_sessions_user_idx ON paddle_checkout_sessions (user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS paddle_checkout_sessions_expires_idx ON paddle_checkout_sessions (expires_at)`);
    await client.query(`
      ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS color text DEFAULT '#2563eb',
        ADD COLUMN IF NOT EXISTS ai_preferences text
    `);
    await client.query(`
      ALTER TABLE settings
        ADD COLUMN IF NOT EXISTS user_id integer,
        ADD COLUMN IF NOT EXISTS default_due_date_mode text DEFAULT 'calendar_month',
        ADD COLUMN IF NOT EXISTS default_due_days integer DEFAULT 30,
        ADD COLUMN IF NOT EXISTS show_payment_terms boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS payment_terms text,
        ADD COLUMN IF NOT EXISTS invoice_header_placement text DEFAULT 'standard',
        ADD COLUMN IF NOT EXISTS invoice_info_layout text DEFAULT 'columns',
        ADD COLUMN IF NOT EXISTS invoice_info_order text DEFAULT 'payment,terms,notes',
        ADD COLUMN IF NOT EXISTS invoice_payment_accent_side text DEFAULT 'left'
    `);
    await client.query(`
      UPDATE settings
      SET user_id = COALESCE(
        (SELECT id FROM users WHERE lower(email) = 'erdegovic@gmail.com' LIMIT 1),
        (SELECT min(id) FROM users)
      )
      WHERE user_id IS NULL
    `);
    await client.query(`
      DELETE FROM settings newer
      USING settings older
      WHERE newer.user_id = older.user_id AND newer.id > older.id
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS settings_user_id_unique ON settings (user_id)`);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'settings_user_id_users_id_fk'
        ) THEN
          ALTER TABLE settings
            ADD CONSTRAINT settings_user_id_users_id_fk
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$
    `);
    await client.query(`ALTER TABLE settings ALTER COLUMN user_id SET NOT NULL`);
    await client.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_unique`);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_invoice_number_unique
      ON invoices (user_id, invoice_number)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_snapshots (
        id text PRIMARY KEY,
        user_id integer NOT NULL,
        object_key text NOT NULL UNIQUE,
        reason text NOT NULL DEFAULT 'scheduled',
        status text NOT NULL DEFAULT 'pending',
        schema_version integer NOT NULL DEFAULT 1,
        byte_size integer,
        checksum text,
        record_counts text,
        error_message text,
        created_at timestamp DEFAULT now(),
        completed_at timestamp
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS account_snapshots_user_created_idx
      ON account_snapshots (user_id, created_at)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS account_snapshots_status_created_idx
      ON account_snapshots (status, created_at)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_audit_events (
        id serial PRIMARY KEY,
        admin_user_id integer REFERENCES users(id) ON DELETE SET NULL,
        target_user_id integer NOT NULL,
        snapshot_id text,
        action text NOT NULL,
        status text NOT NULL,
        details text,
        created_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS backup_audit_events_target_created_idx
      ON backup_audit_events (target_user_id, created_at)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_events (
        id bigserial PRIMARY KEY,
        admin_user_id integer REFERENCES users(id) ON DELETE SET NULL,
        target_user_id integer REFERENCES users(id) ON DELETE SET NULL,
        action text NOT NULL,
        outcome text NOT NULL DEFAULT 'success',
        request_id text,
        ip_hash text,
        details text,
        created_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS admin_audit_events_admin_created_idx
      ON admin_audit_events (admin_user_id, created_at)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS admin_audit_events_target_created_idx
      ON admin_audit_events (target_user_id, created_at)
    `);
    await client.query(`
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
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS ai_artifacts_user_created_idx ON ai_artifacts(user_id, created_at)`);
    await client.query(`
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
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_idx ON ai_usage_events(user_id, created_at)`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS gmail_connections (
        user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email text NOT NULL,
        encrypted_refresh_token text NOT NULL,
        scope text NOT NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
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
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS recurring_invoice_schedules_user_idx ON recurring_invoice_schedules(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS recurring_invoice_schedules_due_idx ON recurring_invoice_schedules(enabled, next_run_at)`);
    await client.query(`
      ALTER TABLE recurring_invoice_schedules
        ADD COLUMN IF NOT EXISTS period_start text,
        ADD COLUMN IF NOT EXISTS period_end text
    `);
    await client.query(`
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
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS invoice_automation_jobs_user_created_idx ON invoice_automation_jobs(user_id, created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS invoice_automation_jobs_status_send_idx ON invoice_automation_jobs(status, send_at)`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_automation_audit (
        id serial PRIMARY KEY,
        job_id text NOT NULL REFERENCES invoice_automation_jobs(id) ON DELETE CASCADE,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action text NOT NULL,
        details text,
        created_at timestamp DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS invoice_automation_audit_job_created_idx ON invoice_automation_audit(job_id, created_at)`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
