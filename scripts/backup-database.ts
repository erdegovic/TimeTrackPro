import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { backupChecksum, encryptBackup } from "../server/backups/crypto";
import { requireBackupConfig } from "../server/backups/config";
import { deleteBackupObject, listBackupObjects, uploadBackupObject } from "../server/backups/object-storage";
import { selectSnapshotsToDelete } from "../server/backups/retention";

function runPgDump(destination: string, databaseUrl: string) {
  const url = new URL(databaseUrl);
  const environment = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")),
    PGSSLMODE: url.searchParams.get("sslmode") || (url.hostname === "localhost" || url.hostname === "127.0.0.1" ? "prefer" : "require"),
  };

  return new Promise<void>((resolve, reject) => {
    const child = spawn("pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--file",
      destination,
    ], { env: environment, stdio: ["ignore", "inherit", "inherit"] });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`pg_dump exited with code ${code}`)));
  });
}

async function main() {
  const config = requireBackupConfig();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const id = randomUUID();
  const now = new Date();
  const temporaryFile = path.join(tmpdir(), `tickd-${id}.dump`);
  const objectKey = `database-backups/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${now.toISOString().replaceAll(":", "-")}-${id}.dump.tickd`;

  try {
    await runPgDump(temporaryFile, databaseUrl);
    const dump = await readFile(temporaryFile);
    const encrypted = encryptBackup(dump, config.encryptionKey);
    await uploadBackupObject(objectKey, encrypted);
    const databaseBackups = await listBackupObjects("database-backups/");
    const expired = selectSnapshotsToDelete(databaseBackups.map((object) => ({
      id: object.key,
      createdAt: object.lastModified,
    })));
    for (const object of expired) await deleteBackupObject(object.id);
    console.log(JSON.stringify({
      status: "complete",
      objectKey,
      encryptedBytes: encrypted.length,
      checksum: backupChecksum(encrypted),
      expiredBackupsRemoved: expired.length,
      createdAt: now.toISOString(),
    }));
  } finally {
    await rm(temporaryFile, { force: true });
  }
}

main().catch((error) => {
  console.error("Database backup failed:", error);
  process.exitCode = 1;
});
