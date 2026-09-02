import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildAmendmentPreview } from "@/lib/board-submissions/amendment/build";
import { amendmentFilename, buildAmendmentWorkbook } from "@/lib/board-submissions/amendment/export";
import { buildAmendmentExportForBaselineVersion } from "@/lib/board-submissions/amendment/history";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const registrationWindowId = request.nextUrl.searchParams.get("registrationWindowId");
  if (!registrationWindowId) {
    return jsonError("registrationWindowId is required", 400);
  }

  const baselineVersionParam = request.nextUrl.searchParams.get("baselineVersion");
  const baselineVersion = baselineVersionParam ? Number.parseInt(baselineVersionParam, 10) : null;

  try {
    if (baselineVersion !== null && !Number.isNaN(baselineVersion)) {
      const historical = await buildAmendmentExportForBaselineVersion({
        registrationWindowId,
        baselineVersion,
      });
      if (!historical) {
        return jsonError("Amendment submission not found for that baseline version", 404);
      }

      const buffer = buildAmendmentWorkbook({
        addRows: historical.addRows,
        removeRows: historical.removeRows,
      });
      const filename = amendmentFilename({
        windowTitle: historical.registrationWindowTitle,
        examBoardCode: historical.examBoardCode,
        baselineVersion,
      });

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const preview = await buildAmendmentPreview(registrationWindowId);
    if (!preview) {
      return jsonError("Registration window not found", 404);
    }
    if (!preview.canExport) {
      return jsonError(
        preview.hasChanges
          ? "Resolve validation issues before exporting"
          : "No pending changes since the latest baseline",
        400,
      );
    }

    const buffer = buildAmendmentWorkbook({
      addRows: preview.addRows,
      removeRows: preview.removeRows,
    });
    const filename = amendmentFilename({
      windowTitle: preview.registrationWindowTitle,
      examBoardCode: preview.examBoardCode,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Amendment export error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to export amendment",
      500,
    );
  }
}
