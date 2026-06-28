import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canConfigureFeeRules } from "@/lib/auth/permissions";
import { upsertCalendarSubjectFeeRulesFromRows } from "@/lib/fees/fee-rules-spreadsheet";
import * as XLSX from "xlsx";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canConfigureFeeRules(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id: registrationWindowId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonError("File is required");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  try {
    const result = await upsertCalendarSubjectFeeRulesFromRows(
      registrationWindowId,
      rows,
      auth.user.id,
    );

    return NextResponse.json({
      imported: result.created + result.updated,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Import failed", 500);
  }
}
