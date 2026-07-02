import fs from "node:fs/promises";
import path from "node:path";
import { logBackupAudit } from "@/lib/backup/audit";
import { getBackupJobById } from "@/lib/backup/jobs";
import { isPathInsideDirectory } from "@/lib/backup/paths";
import { getResolvedBackupSettings } from "@/lib/backup/settings";
import { prisma } from "@/lib/prisma";

export async function resolveBackupFileForJob(jobId: string) {
  const job = await getBackupJobById(jobId);
  if (!job || job.status !== "SUCCESS" || !job.filePath || !job.fileName) {
    return null;
  }

  const settings = await getResolvedBackupSettings();
  if (!isPathInsideDirectory(job.filePath, settings.backupDirectory)) {
    throw new Error("Backup file path is outside the configured backup directory.");
  }

  try {
    await fs.access(job.filePath);
  } catch {
    return null;
  }

  return {
    job,
    filePath: path.resolve(job.filePath),
    fileName: job.fileName,
  };
}

export async function deleteBackupJob(jobId: string, performedById: string) {
  const resolved = await resolveBackupFileForJob(jobId);
  const job = resolved?.job ?? (await getBackupJobById(jobId));
  if (!job) throw new Error("Backup job not found");

  if (resolved?.filePath) {
    await fs.unlink(resolved.filePath);
  } else if (job.filePath) {
    try {
      await fs.unlink(job.filePath);
    } catch {
      // file may already be missing
    }
  }

  await prisma.backupJob.delete({ where: { id: jobId } });

  await logBackupAudit({
    action: "BACKUP_FILE_DELETED",
    performedById,
    metadata: {
      jobId,
      fileName: job.fileName,
    },
  });
}
