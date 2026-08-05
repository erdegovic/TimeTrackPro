import { randomUUID } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { backupChecksum, decryptBackup, encryptBackup } from "./crypto";
import { getBackupConfig, requireBackupConfig } from "./config";
import { deleteBackupObject, downloadBackupObject, uploadBackupObject } from "./object-storage";
import { selectSnapshotsToDelete } from "./retention";

const SNAPSHOT_FORMAT = "tickd-account-snapshot";
const SNAPSHOT_SCHEMA_VERSION = 1;
const BACKUP_LOCK_ID = 846_210_517;

const accountTableNames = [
  "clients",
  "projects",
  "invoices",
  "time_entries",
  "time_entry_notes",
  "settings",
  "creativity_notes",
  "weekly_goals",
  "gratitude_entries",
  "focus_sessions",
] as const;

type AccountTableName = typeof accountTableNames[number];
type SnapshotReason = "scheduled" | "manual" | "pre_restore";

type AccountSnapshotPayload = {
  format: typeof SNAPSHOT_FORMAT;
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  userId: number;
  createdAt: string;
  userProfile: Record<string, unknown>;
  tables: Record<AccountTableName, Record<string, unknown>[]>;
};

export type SnapshotMetadata = {
  id: string;
  userId: number;
  objectKey: string;
  reason: string;
  status: string;
  schemaVersion: number;
  byteSize: number | null;
  checksum: string | null;
  recordCounts: Record<string, number>;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

const deleteOrder: AccountTableName[] = [
  "time_entry_notes",
  "time_entries",
  "invoices",
  "projects",
  "clients",
  "settings",
  "creativity_notes",
  "weekly_goals",
  "gratitude_entries",
  "focus_sessions",
];

const insertOrder: AccountTableName[] = [
  "clients",
  "projects",
  "invoices",
  "time_entries",
  "time_entry_notes",
  "settings",
  "creativity_notes",
  "weekly_goals",
  "gratitude_entries",
  "focus_sessions",
];

const sequenceTables = [
  "clients",
  "projects",
  "invoices",
  "time_entries",
  "time_entry_notes",
  "settings",
  "creativity_notes",
  "weekly_goals",
  "gratitude_entries",
  "focus_sessions",
] as const;

function parseRecordCounts(value: unknown): Record<string, number> {
  if (!value) return {};
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" ? parsed as Record<string, number> : {};
  } catch {
    return {};
  }
}

function mapMetadata(row: any): SnapshotMetadata {
  return {
    id: row.id,
    userId: Number(row.user_id),
    objectKey: row.object_key,
    reason: row.reason,
    status: row.status,
    schemaVersion: Number(row.schema_version),
    byteSize: row.byte_size === null ? null : Number(row.byte_size),
    checksum: row.checksum,
    recordCounts: parseRecordCounts(row.record_counts),
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  };
}

function validateSnapshotPayload(value: unknown): AccountSnapshotPayload {
  if (!value || typeof value !== "object") throw new Error("Backup payload is not an object");
  const payload = value as Partial<AccountSnapshotPayload>;
  if (payload.format !== SNAPSHOT_FORMAT || payload.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    throw new Error("Backup format or schema version is not supported");
  }
  if (!Number.isInteger(payload.userId) || !payload.tables || typeof payload.tables !== "object") {
    throw new Error("Backup payload is missing account data");
  }
  for (const tableName of accountTableNames) {
    if (!Array.isArray(payload.tables[tableName])) {
      throw new Error(`Backup payload is missing ${tableName}`);
    }
  }
  return payload as AccountSnapshotPayload;
}

async function readAccountPayload(client: PoolClient, userId: number): Promise<AccountSnapshotPayload> {
  const userResult = await client.query(`
    SELECT id, first_name, last_name, profile_image_url, invoice_label_overrides, custom_currency_rates
    FROM users
    WHERE id = $1
  `, [userId]);
  if (!userResult.rowCount) throw new Error("User not found");

  const tables = {} as AccountSnapshotPayload["tables"];
  for (const tableName of accountTableNames) {
    const result = await client.query(`SELECT * FROM ${tableName} WHERE user_id = $1 ORDER BY id`, [userId]);
    tables[tableName] = result.rows;
  }

  return {
    format: SNAPSHOT_FORMAT,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    userId,
    createdAt: new Date().toISOString(),
    userProfile: userResult.rows[0],
    tables,
  };
}

function getRecordCounts(payload: AccountSnapshotPayload) {
  return Object.fromEntries(accountTableNames.map((tableName) => [tableName, payload.tables[tableName].length]));
}

export async function createAccountSnapshot(
  userId: number,
  reason: SnapshotReason = "scheduled",
): Promise<SnapshotMetadata> {
  const config = requireBackupConfig();
  const id = randomUUID();
  const now = new Date();
  const objectKey = `account-snapshots/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}.tickd`;

  await pool.query(`
    INSERT INTO account_snapshots (id, user_id, object_key, reason, status, schema_version)
    VALUES ($1, $2, $3, $4, 'pending', $5)
  `, [id, userId, objectKey, reason, SNAPSHOT_SCHEMA_VERSION]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const payload = await readAccountPayload(client, userId);
    await client.query("COMMIT");

    const compressed = gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
    const encrypted = encryptBackup(compressed, config.encryptionKey);
    const checksum = backupChecksum(encrypted);
    const recordCounts = getRecordCounts(payload);

    await uploadBackupObject(objectKey, encrypted);
    const result = await pool.query(`
      UPDATE account_snapshots
      SET status = 'complete', byte_size = $2, checksum = $3,
          record_counts = $4, completed_at = now(), error_message = NULL
      WHERE id = $1
      RETURNING *
    `, [id, encrypted.length, checksum, JSON.stringify(recordCounts)]);
    return mapMetadata(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const message = error instanceof Error ? error.message : "Unknown backup failure";
    await pool.query(`
      UPDATE account_snapshots
      SET status = 'failed', error_message = $2, completed_at = now()
      WHERE id = $1
    `, [id, message.slice(0, 1000)]).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getLatestAccountSnapshot(userId: number): Promise<SnapshotMetadata | null> {
  const result = await pool.query(`
    SELECT * FROM account_snapshots
    WHERE user_id = $1 AND status = 'complete'
    ORDER BY created_at DESC
    LIMIT 1
  `, [userId]);
  return result.rows[0] ? mapMetadata(result.rows[0]) : null;
}

export async function getAccountBackupState(userId: number) {
  const config = getBackupConfig();
  const [latestAttemptResult, latestComplete] = await Promise.all([
    pool.query(`
      SELECT * FROM account_snapshots
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]),
    getLatestAccountSnapshot(userId),
  ]);
  const latestAttempt = latestAttemptResult.rows[0] ? mapMetadata(latestAttemptResult.rows[0]) : null;
  const staleAfterMs = config.intervalHours * 2.5 * 60 * 60 * 1000;
  const stale = latestComplete ? Date.now() - latestComplete.createdAt.getTime() > staleAfterMs : false;

  return {
    latestSnapshot: latestComplete,
    status: latestAttempt?.status === "failed"
      ? "failed"
      : stale
        ? "stale"
        : latestComplete
          ? "protected"
          : "waiting",
    restoreAvailable: Boolean(latestComplete),
  };
}

export async function getSnapshotById(snapshotId: string): Promise<SnapshotMetadata | null> {
  const result = await pool.query(`SELECT * FROM account_snapshots WHERE id = $1`, [snapshotId]);
  return result.rows[0] ? mapMetadata(result.rows[0]) : null;
}

async function loadSnapshotPayload(metadata: SnapshotMetadata): Promise<AccountSnapshotPayload> {
  if (metadata.status !== "complete" || !metadata.checksum) throw new Error("Snapshot is not restorable");
  const config = requireBackupConfig();
  const encrypted = await downloadBackupObject(metadata.objectKey);
  if (backupChecksum(encrypted) !== metadata.checksum) throw new Error("Backup checksum verification failed");
  const decoded = gunzipSync(decryptBackup(encrypted, config.encryptionKey));
  return validateSnapshotPayload(JSON.parse(decoded.toString("utf8")));
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function insertRows(client: PoolClient, tableName: AccountTableName, rows: Record<string, unknown>[]) {
  for (const row of rows) {
    const columns = Object.keys(row);
    if (!columns.length) continue;
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const sql = `INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${placeholders})`;
    await client.query(sql, columns.map((column) => row[column]));
  }
}

async function synchronizeSequences(client: PoolClient) {
  for (const tableName of sequenceTables) {
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('${tableName}', 'id'),
        GREATEST(COALESCE((SELECT max(id) FROM ${tableName}), 0) + 1, 1),
        false
      )
    `);
  }
}

async function recordAuditEvent(data: {
  adminUserId: number;
  targetUserId: number;
  snapshotId: string;
  status: "complete" | "failed";
  details?: string;
}) {
  await pool.query(`
    INSERT INTO backup_audit_events
      (admin_user_id, target_user_id, snapshot_id, action, status, details)
    VALUES ($1, $2, $3, 'restore', $4, $5)
  `, [data.adminUserId, data.targetUserId, data.snapshotId, data.status, data.details || null]);
}

export async function restoreAccountSnapshot(data: {
  adminUserId: number;
  targetUserId: number;
  snapshotId: string;
}) {
  const metadata = await getSnapshotById(data.snapshotId);
  if (!metadata || metadata.userId !== data.targetUserId) throw new Error("Snapshot was not found for this account");
  const payload = await loadSnapshotPayload(metadata);
  if (payload.userId !== data.targetUserId) throw new Error("Snapshot account verification failed");
  for (const tableName of accountTableNames) {
    if (payload.tables[tableName].some((row) => Number(row.user_id) !== data.targetUserId)) {
      throw new Error(`Snapshot ownership verification failed for ${tableName}`);
    }
  }

  // Never begin a destructive restore unless the current state is safely stored.
  const safetySnapshot = await createAccountSnapshot(data.targetUserId, "pre_restore");
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const userResult = await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [data.targetUserId]);
    if (!userResult.rowCount) throw new Error("User no longer exists");

    for (const tableName of deleteOrder) {
      await client.query(`DELETE FROM ${quoteIdentifier(tableName)} WHERE user_id = $1`, [data.targetUserId]);
    }
    for (const tableName of insertOrder) {
      await insertRows(client, tableName, payload.tables[tableName]);
    }

    const profile = payload.userProfile;
    await client.query(`
      UPDATE users SET
        first_name = $2,
        last_name = $3,
        profile_image_url = $4,
        invoice_label_overrides = $5,
        custom_currency_rates = $6,
        updated_at = now()
      WHERE id = $1
    `, [
      data.targetUserId,
      profile.first_name ?? null,
      profile.last_name ?? null,
      profile.profile_image_url ?? null,
      profile.invoice_label_overrides ?? null,
      profile.custom_currency_rates ?? null,
    ]);
    await synchronizeSequences(client);
    await client.query("COMMIT");

    // connect-pg-simple stores userId inside the JSON session payload.
    await pool.query(`DELETE FROM express_sessions WHERE sess->>'userId' = $1`, [String(data.targetUserId)]).catch(() => undefined);
    await recordAuditEvent({
      ...data,
      status: "complete",
      details: JSON.stringify({ safetySnapshotId: safetySnapshot.id }),
    });
    return { restoredSnapshot: metadata, safetySnapshot };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    await recordAuditEvent({
      ...data,
      status: "failed",
      details: error instanceof Error ? error.message.slice(0, 1000) : "Unknown restore failure",
    }).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function pruneUserSnapshots(userId: number) {
  const result = await pool.query(`
    SELECT id, object_key, created_at
    FROM account_snapshots
    WHERE user_id = $1 AND status = 'complete'
    ORDER BY created_at DESC
  `, [userId]);
  const toDelete = selectSnapshotsToDelete(result.rows.map((row) => ({
    id: row.id,
    createdAt: new Date(row.created_at),
  })));
  const objectKeys = new Map(result.rows.map((row) => [row.id, row.object_key]));
  for (const snapshot of toDelete) {
    const objectKey = objectKeys.get(snapshot.id);
    if (!objectKey) continue;
    await deleteBackupObject(objectKey);
    await pool.query("DELETE FROM account_snapshots WHERE id = $1", [snapshot.id]);
  }
  await pool.query(`
    DELETE FROM account_snapshots
    WHERE user_id = $1 AND status = 'failed' AND created_at < now() - interval '30 days'
  `, [userId]);
}

export async function runAccountBackupCycle(reason: "scheduled" | "manual" = "scheduled") {
  const config = getBackupConfig();
  if (!config.enabled || !config.configured) {
    return { status: "not_configured" as const, successful: 0, failed: 0 };
  }

  const lockClient = await pool.connect();
  const lock = await lockClient.query("SELECT pg_try_advisory_lock($1) AS acquired", [BACKUP_LOCK_ID]);
  if (!lock.rows[0]?.acquired) {
    lockClient.release();
    return { status: "already_running" as const, successful: 0, failed: 0 };
  }

  let successful = 0;
  let failed = 0;
  try {
    const users = await pool.query("SELECT id FROM users ORDER BY id");
    for (const user of users.rows) {
      try {
        await createAccountSnapshot(Number(user.id), reason);
        await pruneUserSnapshots(Number(user.id));
        successful += 1;
      } catch (error) {
        failed += 1;
        console.error(`Account backup failed for user ${user.id}:`, error);
      }
    }
    return { status: failed ? "partial" as const : "complete" as const, successful, failed };
  } finally {
    await lockClient.query("SELECT pg_advisory_unlock($1)", [BACKUP_LOCK_ID]).catch(() => undefined);
    lockClient.release();
  }
}

export async function getBackupSystemSummary() {
  const config = getBackupConfig();
  if (!config.configured || !config.enabled) {
    return {
      status: "not_configured",
      restoreStatus: "disabled",
      latestSnapshotAt: null,
      protectedUsers: 0,
      missing: config.missing,
    };
  }

  const result = await pool.query(`
    SELECT
      max(completed_at) FILTER (WHERE status = 'complete') AS latest_snapshot_at,
      count(DISTINCT user_id) FILTER (WHERE status = 'complete')::int AS protected_users,
      bool_or(status = 'failed' AND created_at > now() - ($1::double precision * interval '1 hour')) AS recent_failure
    FROM account_snapshots
  `, [config.intervalHours * 2.5]);
  const latestSnapshotAt = result.rows[0]?.latest_snapshot_at ? new Date(result.rows[0].latest_snapshot_at) : null;
  const stale = latestSnapshotAt
    ? Date.now() - latestSnapshotAt.getTime() > config.intervalHours * 2.5 * 60 * 60 * 1000
    : false;
  const status = result.rows[0]?.recent_failure
    ? "degraded"
    : stale
      ? "stale"
      : latestSnapshotAt
        ? "healthy"
        : "waiting_for_first_backup";
  return {
    status,
    restoreStatus: latestSnapshotAt ? "available" : "disabled",
    latestSnapshotAt,
    protectedUsers: Number(result.rows[0]?.protected_users || 0),
    missing: [],
  };
}
