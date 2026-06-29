import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canGenerateFeeStatements } from "@/lib/auth/permissions";
import { parseFeeReportFilters } from "@/lib/fees/filters";
import { buildFeeSummaryReport } from "@/lib/fees/reporting";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canGenerateFeeStatements(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  try {
    const filters = parseFeeReportFilters(request.nextUrl.searchParams);
    const report = await buildFeeSummaryReport(filters);
    return NextResponse.json(report);
  } catch (error) {
    console.error("Fee summary error:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to load fee summary", 500);
  }
}
