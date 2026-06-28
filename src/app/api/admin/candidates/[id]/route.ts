import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canViewAllRegistrations } from "@/lib/auth/permissions";
import { getCandidateById } from "@/lib/candidates/list";
import { updateCandidate, upsertCandidateExamIdentity } from "@/lib/candidates/import";
import { backfillCandidatesFromStudents } from "@/lib/candidates/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canViewAllRegistrations(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const candidate = await getCandidateById(id);
  if (!candidate) return jsonError("Candidate not found", 404);
  return NextResponse.json(candidate);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const data = parseJsonBody<{
    englishName?: string;
    chineseName?: string;
    email?: string;
    phone?: string;
    grade?: string;
    className?: string;
    status?: string;
    loginEnabled?: boolean;
    assessmentHubCandidateNumber?: string;
    examIdentity?: {
      examBoardId?: string;
      centreNumber?: string;
      boardCandidateNumber?: string;
      uci?: string;
      notes?: string;
    };
    syncFromStudents?: boolean;
  }>(body, []);

  if (data?.syncFromStudents) {
    const result = await backfillCandidatesFromStudents();
    return NextResponse.json(result);
  }

  if (!data) return jsonError("Invalid payload", 400);

  try {
    if (data.examIdentity?.examBoardId) {
      await upsertCandidateExamIdentity(id, data.examIdentity.examBoardId, {
        centreNumber: data.examIdentity.centreNumber ?? null,
        boardCandidateNumber: data.examIdentity.boardCandidateNumber ?? null,
        uci: data.examIdentity.uci ?? null,
        notes: data.examIdentity.notes ?? null,
      });
    }

    const candidate = await updateCandidate(id, {
      ...(data.englishName !== undefined ? { englishName: data.englishName } : {}),
      ...(data.chineseName !== undefined ? { chineseName: data.chineseName || null } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.grade !== undefined ? { grade: data.grade || null } : {}),
      ...(data.className !== undefined ? { className: data.className || null } : {}),
      ...(data.status ? { status: data.status as never } : {}),
      ...(data.loginEnabled !== undefined ? { loginEnabled: data.loginEnabled } : {}),
      ...(data.assessmentHubCandidateNumber !== undefined
        ? { assessmentHubCandidateNumber: data.assessmentHubCandidateNumber }
        : {}),
    });

    return NextResponse.json(await getCandidateById(candidate.id));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Update failed", 500);
  }
}
