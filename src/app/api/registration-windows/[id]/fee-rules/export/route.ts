import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canConfigureFeeRules } from "@/lib/auth/permissions";
import {
  buildCalendarSubjectFeeRuleExportRows,
  feeRuleSpreadsheetToBuffer,
} from "@/lib/fees/fee-rules-spreadsheet";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canConfigureFeeRules(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const rows = await buildCalendarSubjectFeeRuleExportRows(id);
  const buffer = feeRuleSpreadsheetToBuffer(rows);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="calendar-subject-fee-rules-${id}.xlsx"`,
    },
  });
}
