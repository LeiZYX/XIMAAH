import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canGenerateFeeStatements, canViewFeeRuleCosts } from "@/lib/auth/permissions";
import { createFeeAuditLog } from "@/lib/fees/audit";
import {
  exportDetailsCsv,
  exportDetailsXlsx,
  exportSummaryCsv,
  exportSummaryXlsx,
} from "@/lib/fees/export";
import { parseFeeReportFilters } from "@/lib/fees/filters";
import { buildFeeDetailsReport, buildFeeSummaryReport } from "@/lib/fees/reporting";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canGenerateFeeStatements(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const type = request.nextUrl.searchParams.get("type") ?? "summary";
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  const filters = parseFeeReportFilters(request.nextUrl.searchParams);
  const showCosts = canViewFeeRuleCosts(auth.user.role);

  try {
    if (type === "summary") {
      const { rows } = await buildFeeSummaryReport(filters);
      await createFeeAuditLog({
        action: "FEE_SUMMARY_EXPORTED",
        performedByUserId: auth.user.id,
        registrationWindowId: filters.registrationWindowId,
        metadata: { format, rowCount: rows.length },
      });

      if (format === "xlsx") {
        const buffer = exportSummaryXlsx(rows);
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="fee-summary.xlsx"',
          },
        });
      }

      const csv = exportSummaryCsv(rows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="fee-summary.csv"',
        },
      });
    }

    if (type === "details") {
      if (!filters.registrationWindowId) {
        return jsonError("registrationWindowId is required for fee details export", 400);
      }
      const rows = await buildFeeDetailsReport(filters, showCosts);
      await createFeeAuditLog({
        action: "FEE_DETAILS_EXPORTED",
        performedByUserId: auth.user.id,
        registrationWindowId: filters.registrationWindowId,
        metadata: { format, rowCount: rows.length },
      });

      if (format === "xlsx") {
        const buffer = exportDetailsXlsx(rows, showCosts);
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="fee-details.xlsx"',
          },
        });
      }

      const csv = exportDetailsCsv(rows, showCosts);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="fee-details.csv"',
        },
      });
    }

    return jsonError("Invalid export type", 400);
  } catch (error) {
    console.error("Fee export error:", error);
    return jsonError(error instanceof Error ? error.message : "Export failed", 500);
  }
}
