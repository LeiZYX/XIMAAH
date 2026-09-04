import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canViewAllRegistrations } from "@/lib/auth/permissions";
import { parseListPagination } from "@/lib/pagination";
import {
  getStudentOverviewClassBuckets,
  getStudentOverviewSummary,
  listStudentOverviewRows,
  parseStudentOverviewFilters,
} from "@/lib/students/overview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canViewAllRegistrations(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  try {
    const filters = parseStudentOverviewFilters(request.nextUrl.searchParams);
    const summaryOnly = request.nextUrl.searchParams.get("summaryOnly") === "true";
    const [summary, byClass] = await Promise.all([
      getStudentOverviewSummary({
        candidateType: filters.candidateType,
        status: filters.status,
      }),
      getStudentOverviewClassBuckets({
        candidateType: filters.candidateType,
        status: filters.status,
        grade: filters.grade,
      }),
    ]);

    if (summaryOnly) {
      return NextResponse.json({ summary, byClass });
    }

    const { page, pageSize } = parseListPagination(request.nextUrl.searchParams);
    const list = await listStudentOverviewRows(filters, page, pageSize);
    return NextResponse.json({ summary, byClass, ...list });
  } catch (error) {
    console.error("GET /api/admin/students/overview failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load student overview",
      500,
    );
  }
}
