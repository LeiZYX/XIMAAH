import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { listBackupJobs, serializeBackupJob } from "@/lib/backup/jobs";
import { getBackupJobById } from "@/lib/backup/jobs";
import { runDatabaseBackup } from "@/lib/backup/run-backup";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  try {
    const result = await runDatabaseBackup({
      triggeredBy: "MANUAL",
      triggeredByUserId: auth.user.id,
      auditUserId: auth.user.id,
    });

    const job = await getBackupJobById(result.jobId);
    if (!job) return jsonError("Backup job not found after run", 500);

    if (result.status === "FAILED") {
      return NextResponse.json(
        {
          ok: false,
          error: result.errorMessage ?? "Backup failed",
          job: serializeBackupJob(job),
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Backup completed successfully.",
      job: serializeBackupJob(job),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Backup failed", 500);
  }
}

export async function GET() {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  return NextResponse.json({ jobs: await listBackupJobs(50) });
}
