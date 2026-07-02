import type { BackupJob } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type BackupJobRow = BackupJob & {
  triggeredByUser: { id: string; name: string } | null;
};

export function serializeBackupJob(job: BackupJobRow) {
  return {
    id: job.id,
    backupType: job.backupType,
    status: job.status,
    fileName: job.fileName,
    fileSizeBytes: job.fileSizeBytes != null ? Number(job.fileSizeBytes) : null,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    errorMessage: job.errorMessage,
    triggeredBy: job.triggeredBy,
    triggeredByUser: job.triggeredByUser
      ? { id: job.triggeredByUser.id, name: job.triggeredByUser.name }
      : null,
    createdAt: job.createdAt.toISOString(),
  };
}

export async function listBackupJobs(limit = 50) {
  const jobs = await prisma.backupJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      triggeredByUser: { select: { id: true, name: true } },
    },
  });
  return jobs.map(serializeBackupJob);
}

export async function getBackupJobById(id: string) {
  return prisma.backupJob.findUnique({
    where: { id },
    include: {
      triggeredByUser: { select: { id: true, name: true } },
    },
  });
}
