import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildCashInCodeExportRows } from "@/lib/cash-in-codes/service";
import { buildCashInCodeImportTemplateBuffer } from "@/lib/cash-in-codes/template";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const examBoardId = request.nextUrl.searchParams.get("examBoardId") ?? undefined;
  const includeExisting = request.nextUrl.searchParams.get("includeExisting") === "true";

  try {
    const existingRows = includeExisting
      ? await buildCashInCodeExportRows(examBoardId)
      : [];
    const buffer = buildCashInCodeImportTemplateBuffer(existingRows);
    const suffix = examBoardId ? `-board` : "";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="cash-in-codes-template${suffix}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/cash-in-codes/template failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to build template",
      500,
    );
  }
}
