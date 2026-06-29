import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageExamData, canViewAllRegistrations } from "@/lib/auth/permissions";
import { listStudents, parseStudentListFilters } from "@/lib/students/list";
import { parseListPagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageExamData(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  try {
    const filters = parseStudentListFilters(request.nextUrl.searchParams);
    const { page, pageSize } = parseListPagination(request.nextUrl.searchParams);
    const result = await listStudents(filters, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to list students:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to load students", 500);
  }
}
