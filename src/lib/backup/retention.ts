import fs from "node:fs/promises";
import path from "node:path";
import { buildBackupFileName, isPathInsideDirectory } from "@/lib/backup/paths";

const BACKUP_FILE_PATTERN = /^xima_assessment_hub_backup_\d{8}_\d{6}\.sql\.gz$/;

export interface RetentionCleanupResult {
  deletedFiles: string[];
  errors: string[];
}

export async function applyBackupRetention(
  backupDirectory: string,
  retentionDays: number,
): Promise<RetentionCleanupResult> {
  const deletedFiles: string[] = [];
  const errors: string[] = [];
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  let entries: string[];
  try {
    entries = await fs.readdir(backupDirectory);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Could not read backup directory");
    return { deletedFiles, errors };
  }

  for (const entry of entries) {
    if (!BACKUP_FILE_PATTERN.test(entry)) continue;
    const filePath = path.join(backupDirectory, entry);
    if (!isPathInsideDirectory(filePath, backupDirectory)) continue;

    try {
      const stat = await fs.stat(filePath);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(filePath);
        deletedFiles.push(entry);
      }
    } catch (error) {
      errors.push(
        `${entry}: ${error instanceof Error ? error.message : "delete failed"}`,
      );
    }
  }

  return { deletedFiles, errors };
}

export function isBackupArtifactFileName(fileName: string): boolean {
  return BACKUP_FILE_PATTERN.test(fileName);
}

export { buildBackupFileName };
