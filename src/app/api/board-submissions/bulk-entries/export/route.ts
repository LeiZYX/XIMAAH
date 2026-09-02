import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  buildBulkEntriesFileParts,
  buildBulkEntriesPreview,
} from "@/lib/board-submissions/bulk-entries/build";
import { bulkEntriesFilename, buildBulkEntriesWorkbook } from "@/lib/board-submissions/bulk-entries/export";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const registrationWindowId = params.get("registrationWindowId");
  const partParam = params.get("part");
  const partNumber = partParam ? Number.parseInt(partParam, 10) : 1;

  if (!registrationWindowId) {
    return jsonError("registrationWindowId is required", 400);
  }
  if (!Number.isFinite(partNumber) || partNumber < 1) {
    return jsonError("part must be a positive integer", 400);
  }

  try {
    const preview = await buildBulkEntriesPreview(registrationWindowId);
    if (!preview) {
      return jsonError("Registration window not found", 404);
    }
    if (!preview.canExport) {
      return jsonError("Resolve validation issues before exporting", 400);
    }

    const parts = buildBulkEntriesFileParts(preview.rows);
    const part = parts.find((item) => item.partIndex === partNumber);
    if (!part) {
      return jsonError("Export part not found", 404);
    }

    const buffer = buildBulkEntriesWorkbook(part.rows);
    const filename = bulkEntriesFilename({
      windowTitle: preview.registrationWindowTitle,
      examBoardCode: preview.examBoardCode,
      partIndex: part.partIndex,
      partCount: part.partCount,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Bulk entries export error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to export bulk entries",
      500,
    );
  }
}
