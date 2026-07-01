import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canPermanentlyDeleteStudent } from "@/lib/auth/permissions";
import { deleteCandidate } from "@/lib/candidates/lifecycle";
import { getCandidateById } from "@/lib/candidates/list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canPermanentlyDeleteStudent(auth.user.role)) return jsonError("Forbidden", 403);

  const { id } = await params;
  const existing = await getCandidateById(id);
  if (!existing) return jsonError("Candidate not found", 404);

  const body = await request.json().catch(() => ({}));
  const data = parseJsonBody<{ reason?: string }>(body, []);

  try {
    const result = await deleteCandidate(id, auth.user.id, data?.reason);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    const status = message.includes("historical records") ? 409 : 500;
    return jsonError(message, status);
  }
}
