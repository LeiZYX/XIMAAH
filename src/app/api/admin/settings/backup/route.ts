import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { logBackupAudit } from "@/lib/backup/audit";
import { listBackupJobs } from "@/lib/backup/jobs";
import {
  getResolvedBackupSettings,
  saveBackupSettings,
} from "@/lib/backup/settings";
import type { BackupFrequency, BackupType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FREQUENCIES: BackupFrequency[] = ["DAILY", "WEEKLY", "MONTHLY"];
const BACKUP_TYPES: BackupType[] = ["DATABASE_ONLY", "DATABASE_AND_UPLOADS"];

export async function GET() {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  try {
    const [settings, jobs] = await Promise.all([
      getResolvedBackupSettings(),
      listBackupJobs(50),
    ]);

    return NextResponse.json({
      settings: {
        enabled: settings.enabled,
        frequency: settings.frequency,
        backupTime: settings.backupTime,
        backupDirectory: settings.backupDirectory,
        retentionDays: settings.retentionDays,
        backupType: settings.backupType,
        updatedAt: settings.updatedAt?.toISOString() ?? null,
      },
      jobs,
      scheduledBackupNote:
        "Scheduled backups require a server cron job calling POST /api/admin/settings/backup/run-scheduled with header x-backup-cron-secret, or running: npm run backup:database",
      restoreNote:
        "For safety, database restore must be performed by server administrator from command line.",
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load backup settings", 500);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const body = await request.json();
  const data = parseJsonBody<{
    enabled?: boolean;
    frequency?: BackupFrequency;
    backupTime?: string;
    backupDirectory?: string;
    retentionDays?: number;
    backupType?: BackupType;
  }>(body, []);

  if (!data) return jsonError("Invalid request body", 400);

  if (data.frequency && !FREQUENCIES.includes(data.frequency)) {
    return jsonError("Invalid backup frequency", 400);
  }
  if (data.backupType && !BACKUP_TYPES.includes(data.backupType)) {
    return jsonError("Invalid backup type", 400);
  }

  try {
    const settings = await saveBackupSettings(data, auth.user.id);
    await logBackupAudit({
      action: "BACKUP_SETTINGS_UPDATED",
      performedById: auth.user.id,
      metadata: {
        enabled: settings.enabled,
        frequency: settings.frequency,
        backupTime: settings.backupTime,
        retentionDays: settings.retentionDays,
        backupType: settings.backupType,
      },
    });

    return NextResponse.json({
      settings: {
        enabled: settings.enabled,
        frequency: settings.frequency,
        backupTime: settings.backupTime,
        backupDirectory: settings.backupDirectory,
        retentionDays: settings.retentionDays,
        backupType: settings.backupType,
        updatedAt: settings.updatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save backup settings", 400);
  }
}
