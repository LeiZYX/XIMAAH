import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCandidateExamIdentityForBoard } from "@/lib/candidates/exam-board-identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER", "SUBJECT_TEACHER"]);
  if (auth.error) return auth.error;

  const examBoardId = request.nextUrl.searchParams.get("examBoardId")?.trim();
  if (!examBoardId) return jsonError("examBoardId is required", 400);

  const { id: candidateId } = await params;
  const identity = await getCandidateExamIdentityForBoard(candidateId, examBoardId);
  return NextResponse.json({ identity });
}
