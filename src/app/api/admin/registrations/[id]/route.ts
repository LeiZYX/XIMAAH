import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { applyPostLockAdjustment } from "@/lib/registrations/adjustment";
import { RegistrationError } from "@/lib/registrations/errors";
import { getRegistrationWorkspaceById } from "@/lib/registrations/workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER", "SUBJECT_TEACHER", "STUDENT"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const workspace = await getRegistrationWorkspaceById(id);
  if (!workspace) return jsonError("Registration workspace not found", 404);

  if (auth.user.role === "STUDENT" && workspace.studentId !== auth.user.id) {
    return jsonError("Forbidden", 403);
  }

  if (
    auth.user.role === "STUDENT" &&
    workspace.visibility === "EXAM_OFFICE_ONLY"
  ) {
    return jsonError("Forbidden", 403);
  }

  if (
    auth.user.role === "SUBJECT_TEACHER" &&
    workspace.visibility === "EXAM_OFFICE_ONLY"
  ) {
    return jsonError("Forbidden", 403);
  }

  return NextResponse.json(workspace);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const data = parseJsonBody<{
    reason?: string;
    addExamSessionIds?: string[];
    removeRegistrationIds?: string[];
    replacements?: Array<{ registrationId: string; newExamSessionId: string }>;
  }>(body, []);

  if (!data?.reason?.trim()) {
    return jsonError("Adjustment reason is required", 400);
  }

  try {
    const workspace = await applyPostLockAdjustment(
      id,
      { id: auth.user.id, role: auth.user.role },
      {
        reason: data.reason.trim(),
        addExamSessionIds: data.addExamSessionIds,
        removeRegistrationIds: data.removeRegistrationIds,
        replacements: data.replacements,
      },
    );
    return NextResponse.json(workspace);
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
