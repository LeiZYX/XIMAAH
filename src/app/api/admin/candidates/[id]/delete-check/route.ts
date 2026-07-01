import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canPermanentlyDeleteStudent } from "@/lib/auth/permissions";
import { getCandidateDeleteBlockers } from "@/lib/candidates/lifecycle";
import { getCandidateById } from "@/lib/candidates/list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canPermanentlyDeleteStudent(auth.user.role)) return jsonError("Forbidden", 403);

  const { id } = await params;
  const candidate = await getCandidateById(id);
  if (!candidate) return jsonError("Candidate not found", 404);

  const blockers = await getCandidateDeleteBlockers(id);
  return NextResponse.json({
    candidateId: id,
    studentId: candidate.studentId,
    canDelete: blockers.canDelete,
    reasons: blockers.reasons,
  });
}
