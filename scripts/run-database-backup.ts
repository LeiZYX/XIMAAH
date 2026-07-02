/**
 * Run a database backup from CLI (for cron / server jobs).
 *
 * Usage:
 *   npm run backup:database
 *   BACKUP_TRIGGER=SCHEDULED npm run backup:database
 */
import "dotenv/config";
import { runDatabaseBackup } from "../src/lib/backup/run-backup";

async function main() {
  const triggeredBy = process.env.BACKUP_TRIGGER === "SCHEDULED" ? "SCHEDULED" : "MANUAL";
  const result = await runDatabaseBackup({ triggeredBy });
  if (result.status === "FAILED") {
    console.error("Backup failed:", result.errorMessage);
    process.exit(1);
  }
  console.log(
    `Backup succeeded: ${result.fileName} (${result.fileSizeBytes ?? 0} bytes), job ${result.jobId}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
