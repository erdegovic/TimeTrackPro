export type BackupConfig = {
  enabled: boolean;
  configured: boolean;
  missing: string[];
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  encryptionKey: string;
  intervalHours: number;
};

const requiredEnvironment = [
  "BACKUP_S3_ENDPOINT",
  "BACKUP_S3_BUCKET",
  "BACKUP_S3_ACCESS_KEY_ID",
  "BACKUP_S3_SECRET_ACCESS_KEY",
  "ACCOUNT_BACKUP_ENCRYPTION_KEY",
] as const;

const parsePositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function getBackupConfig(): BackupConfig {
  const missing = requiredEnvironment.filter((name) => !process.env[name]?.trim());

  return {
    enabled: process.env.BACKUP_ENABLED === "true",
    configured: missing.length === 0,
    missing,
    endpoint: process.env.BACKUP_S3_ENDPOINT?.trim() || "",
    region: process.env.BACKUP_S3_REGION?.trim() || "auto",
    bucket: process.env.BACKUP_S3_BUCKET?.trim() || "",
    accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID?.trim() || "",
    secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY?.trim() || "",
    encryptionKey: process.env.ACCOUNT_BACKUP_ENCRYPTION_KEY?.trim() || "",
    intervalHours: parsePositiveNumber(process.env.BACKUP_INTERVAL_HOURS, 12),
  };
}

export function requireBackupConfig(): BackupConfig {
  const config = getBackupConfig();
  if (!config.configured) {
    throw new Error(`Backup storage is missing: ${config.missing.join(", ")}`);
  }
  return config;
}
