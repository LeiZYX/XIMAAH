import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { logBackupAudit } from "@/lib/backup/audit";
import { resolveBackupFileForJob } from "@/lib/backup/files";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const { id } = await params;

  try {
    const resolved = await resolveBackupFileForJob(id);
    if (!resolved) return jsonError("Backup file not found", 404);

    await logBackupAudit({
      action: "BACKUP_FILE_DOWNLOADED",
      performedById: auth.user.id,
      metadata: {
        jobId: id,
        fileName: resolved.fileName,
      },
    });

    const stream = createReadStream(resolved.filePath);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${resolved.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Download failed", 500);
  }
}
