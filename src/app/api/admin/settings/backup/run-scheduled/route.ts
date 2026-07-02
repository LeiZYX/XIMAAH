import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { BACKUP_CRON_SECRET_ENV } from "@/lib/backup/constants";
import { getBackupJobById, serializeBackupJob } from "@/lib/backup/jobs";
import { getResolvedBackupSettings } from "@/lib/backup/settings";
import { runDatabaseBackup } from "@/lib/backup/run-backup";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const expectedSecret = process.env[BACKUP_CRON_SECRET_ENV]?.trim();
  const providedSecret = request.headers.get("x-backup-cron-secret")?.trim();

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return jsonError("Forbidden", 403);
  }

  const settings = await getResolvedBackupSettings();
  if (!settings.enabled) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Scheduled backup is disabled in settings.",
    });
  }

  try {
    const result = await runDatabaseBackup({ triggeredBy: "SCHEDULED" });
    const job = await getBackupJobById(result.jobId);

    if (result.status === "FAILED") {
      return NextResponse.json(
        {
          ok: false,
          error: result.errorMessage ?? "Scheduled backup failed",
          job: job ? serializeBackupJob(job) : null,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      job: job ? serializeBackupJob(job) : null,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Scheduled backup failed", 500);
  }
}
