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
);

CREATE INDEX IF NOT EXISTS account_snapshots_user_created_idx
  ON account_snapshots (user_id, created_at);

CREATE INDEX IF NOT EXISTS account_snapshots_status_created_idx
  ON account_snapshots (status, created_at);

CREATE TABLE IF NOT EXISTS backup_audit_events (
  id serial PRIMARY KEY,
  admin_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  target_user_id integer NOT NULL,
  snapshot_id text,
  action text NOT NULL,
  status text NOT NULL,
  details text,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backup_audit_events_target_created_idx
  ON backup_audit_events (target_user_id, created_at);
