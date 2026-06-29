import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canGenerateFeeStatements, canViewFeeRuleCosts } from "@/lib/auth/permissions";
import { parseFeeDetailsPagination, parseFeeReportFilters } from "@/lib/fees/filters";
import { buildFeeDetailsReportPaginated } from "@/lib/fees/reporting";

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
    if (!filters.registrationWindowId) {
      return NextResponse.json({
        groups: [],
        totalCandidates: 0,
        totalLines: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
        showCosts: canViewFeeRuleCosts(auth.user.role),
        requiresRegistrationWindow: true,
      });
    }

    const { page, pageSize } = parseFeeDetailsPagination(request.nextUrl.searchParams);
    const showCosts = canViewFeeRuleCosts(auth.user.role);
    const result = await buildFeeDetailsReportPaginated(filters, showCosts, page, pageSize);

    return NextResponse.json({
      ...result,
      showCosts,
      requiresRegistrationWindow: false,
    });
  } catch (error) {
    console.error("Fee details error:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to load fee details", 500);
  }
}
