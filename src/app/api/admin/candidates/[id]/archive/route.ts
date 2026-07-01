import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageStudentLifecycle } from "@/lib/auth/permissions";
import { archiveCandidate } from "@/lib/candidates/lifecycle";
import { getCandidateById } from "@/lib/candidates/list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canManageStudentLifecycle(auth.user.role)) return jsonError("Forbidden", 403);

  const { id } = await params;
  const existing = await getCandidateById(id);
  if (!existing) return jsonError("Candidate not found", 404);

  const body = await request.json().catch(() => ({}));
  const data = parseJsonBody<{ reason?: string }>(body, []);

  try {
    await archiveCandidate(id, auth.user.id, data?.reason);
    const candidate = await getCandidateById(id);
    return NextResponse.json(candidate);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Archive failed", 500);
  }
}
