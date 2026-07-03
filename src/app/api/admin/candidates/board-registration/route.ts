import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canViewAllRegistrations } from "@/lib/auth/permissions";
import { listExamBoardIdentityRows } from "@/lib/candidates/exam-board-identity";
import { parseCandidateListFilters } from "@/lib/candidates/list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canViewAllRegistrations(auth.user.role)) return jsonError("Forbidden", 403);

  const searchParams = request.nextUrl.searchParams;
  const filters = parseCandidateListFilters(searchParams);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "50") || 50));

  const result = await listExamBoardIdentityRows(filters, page, pageSize);
  return NextResponse.json(result);
}
