import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { canViewAllRegistrations } from "@/lib/auth/permissions";
import {
  examBoardIdentityRowsToCsv,
  exportExamBoardIdentityRows,
} from "@/lib/candidates/exam-board-identity";
import { parseCandidateListFilters } from "@/lib/candidates/list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canViewAllRegistrations(auth.user.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const filters = parseCandidateListFilters(request.nextUrl.searchParams);
  const rows = await exportExamBoardIdentityRows(filters);
  const csv = examBoardIdentityRowsToCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="candidate-board-registration.csv"',
    },
  });
}
