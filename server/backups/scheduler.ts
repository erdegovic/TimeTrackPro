import { getBackupConfig } from "./config";
import { runAccountBackupCycle } from "./account-snapshots";

export function startBackupScheduler() {
  const config = getBackupConfig();
  if (!config.enabled) {
    console.log("Account backup scheduler disabled (BACKUP_ENABLED is not true)");
    return;
  }
  if (!config.configured) {
    console.warn(`Account backup scheduler is missing: ${config.missing.join(", ")}`);
    return;
  }

  const run = () => {
    runAccountBackupCycle("scheduled")
      .then((result) => console.log("Account backup cycle finished:", result))
      .catch((error) => console.error("Account backup cycle failed:", error));
  };

  // Let startup and health checks settle before the initial cycle.
  const initialTimer = setTimeout(run, 60_000);
  initialTimer.unref();
  const interval = setInterval(run, config.intervalHours * 60 * 60 * 1000);
  interval.unref();
  console.log(`Account backup scheduler enabled every ${config.intervalHours} hours`);
}
