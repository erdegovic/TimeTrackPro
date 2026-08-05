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
        ADD COLUMN IF NOT EXISTS subscription_changed_at timestamp DEFAULT now()
    `);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS color text DEFAULT '#2563eb'`);
    await client.query(`
      ALTER TABLE settings
        ADD COLUMN IF NOT EXISTS user_id integer,
        ADD COLUMN IF NOT EXISTS default_due_date_mode text DEFAULT 'calendar_month',
        ADD COLUMN IF NOT EXISTS default_due_days integer DEFAULT 30,
        ADD COLUMN IF NOT EXISTS show_payment_terms boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS payment_terms text
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
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
