import type { BackupFrequency, BackupType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  BACKUP_SETTINGS_ID,
  DEFAULT_BACKUP_DIRECTORY,
} from "@/lib/backup/constants";
import {
  getDevBackupDirectory,
  isValidBackupTime,
  normalizeBackupDirectory,
} from "@/lib/backup/paths";

export interface BackupSettingsInput {
  enabled?: boolean;
  frequency?: BackupFrequency;
  backupTime?: string;
  backupDirectory?: string;
  retentionDays?: number;
  backupType?: BackupType;
}

export interface ResolvedBackupSettings {
  enabled: boolean;
  frequency: BackupFrequency;
  backupTime: string;
  backupDirectory: string;
  retentionDays: number;
  backupType: BackupType;
  updatedAt: Date | null;
  updatedByUserId: string | null;
}

function defaultBackupDirectory(): string {
  if (process.env.NODE_ENV === "development") {
    return getDevBackupDirectory();
  }
  return process.env.BACKUP_DIRECTORY?.trim() || DEFAULT_BACKUP_DIRECTORY;
}

export async function ensureBackupSettings() {
  let row = await prisma.backupSetting.upsert({
    where: { id: BACKUP_SETTINGS_ID },
    create: {
      id: BACKUP_SETTINGS_ID,
      backupDirectory: defaultBackupDirectory(),
    },
    update: {},
  });

  if (
    process.env.NODE_ENV === "development" &&
    row.backupDirectory.startsWith("/var/backups/")
  ) {
    row = await prisma.backupSetting.update({
      where: { id: BACKUP_SETTINGS_ID },
      data: { backupDirectory: getDevBackupDirectory() },
    });
  }

  return row;
}

export async function getResolvedBackupSettings(): Promise<ResolvedBackupSettings> {
  const row = await ensureBackupSettings();
  return {
    enabled: row.enabled,
    frequency: row.frequency,
    backupTime: row.backupTime,
    backupDirectory: row.backupDirectory,
    retentionDays: row.retentionDays,
    backupType: row.backupType,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
  };
}

export async function saveBackupSettings(
  input: BackupSettingsInput,
  updatedByUserId: string,
): Promise<ResolvedBackupSettings> {
  if (input.backupTime !== undefined && !isValidBackupTime(input.backupTime)) {
    throw new Error("Backup time must be in HH:mm format (00:00–23:59).");
  }

  if (input.retentionDays !== undefined) {
    if (!Number.isInteger(input.retentionDays) || input.retentionDays < 1 || input.retentionDays > 3650) {
      throw new Error("Retention days must be between 1 and 3650.");
    }
  }

  if (input.backupType === "DATABASE_AND_UPLOADS") {
    throw new Error("DATABASE_AND_UPLOADS is not available yet.");
  }

  const backupDirectory =
    input.backupDirectory !== undefined
      ? normalizeBackupDirectory(input.backupDirectory)
      : undefined;

  await prisma.backupSetting.upsert({
    where: { id: BACKUP_SETTINGS_ID },
    create: {
      id: BACKUP_SETTINGS_ID,
      enabled: input.enabled ?? false,
      frequency: input.frequency ?? "DAILY",
      backupTime: input.backupTime ?? "02:00",
      backupDirectory: backupDirectory ?? defaultBackupDirectory(),
      retentionDays: input.retentionDays ?? 30,
      backupType: input.backupType ?? "DATABASE_ONLY",
      updatedByUserId,
    },
    update: {
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
      ...(input.backupTime !== undefined ? { backupTime: input.backupTime.trim() } : {}),
      ...(backupDirectory !== undefined ? { backupDirectory } : {}),
      ...(input.retentionDays !== undefined ? { retentionDays: input.retentionDays } : {}),
      ...(input.backupType !== undefined ? { backupType: input.backupType } : {}),
      updatedByUserId,
    },
  });

  return getResolvedBackupSettings();
}
