import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { applyCandidateRegistrationFeeSelection } from "@/lib/fees/candidate-registration-fee";
import { applyLockedRegistrationAdjustment } from "@/lib/registrations/locked-registration-adjustment";
import { RegistrationError } from "@/lib/registrations/errors";
import {
  canStudentViewRegistration,
  teacherCanViewWorkspace,
} from "@/lib/registrations/visibility";
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

  if (auth.user.role === "STUDENT" && !canStudentViewRegistration(workspace)) {
    return jsonError("Forbidden", 403);
  }

  if (auth.user.role === "SUBJECT_TEACHER") {
    const allowed = await teacherCanViewWorkspace(id, auth.user.id);
    if (!allowed) return jsonError("Forbidden", 403);
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
    includeCandidateRegistrationFee?: boolean;
    candidateRegistrationFeeReason?: string;
  }>(body, []);

  if (!data?.reason?.trim()) {
    return jsonError("Adjustment reason is required", 400);
  }

  if (
    data.includeCandidateRegistrationFee !== undefined &&
    data.includeCandidateRegistrationFee !== (await getRegistrationWorkspaceById(id))?.includeCandidateRegistrationFee &&
    !data.candidateRegistrationFeeReason?.trim()
  ) {
    return jsonError("Reason is required when adding or removing Candidate Registration Fee", 400);
  }

  try {
    const existing = await getRegistrationWorkspaceById(id);
    if (!existing) return jsonError("Registration workspace not found", 404);
    if (existing.registrationType !== "INTERNAL_NORMAL") {
      return jsonError("Post-lock adjustment only applies to normal internal registrations", 400);
    }

    const workspace = await applyLockedRegistrationAdjustment(
      id,
      { id: auth.user.id, role: auth.user.role },
      {
        reason: data.reason.trim(),
        addExamSessionIds: data.addExamSessionIds,
        removeRegistrationIds: data.removeRegistrationIds,
        replacements: data.replacements,
        includeCandidateRegistrationFee: data.includeCandidateRegistrationFee,
        candidateRegistrationFeeReason: data.candidateRegistrationFeeReason,
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const data = parseJsonBody<{
    includeCandidateRegistrationFee?: boolean;
    candidateRegistrationFeeReason?: string;
  }>(body, []);

  if (data?.includeCandidateRegistrationFee === undefined) {
    return jsonError("includeCandidateRegistrationFee is required", 400);
  }

  const workspace = await getRegistrationWorkspaceById(id);
  if (!workspace) return jsonError("Registration workspace not found", 404);

  if (
    data.includeCandidateRegistrationFee !== workspace.includeCandidateRegistrationFee &&
    !data.candidateRegistrationFeeReason?.trim()
  ) {
    return jsonError("Reason is required when adding or removing Candidate Registration Fee", 400);
  }

  try {
    await applyCandidateRegistrationFeeSelection({
      workspaceId: id,
      includeCandidateRegistrationFee: data.includeCandidateRegistrationFee,
      performedBy: { id: auth.user.id, role: auth.user.role },
      reason: data.candidateRegistrationFeeReason?.trim(),
    });
    const updated = await getRegistrationWorkspaceById(id);
    if (!workspace) return jsonError("Registration workspace not found", 404);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    if (error instanceof Error) {
      return jsonError(error.message, 400);
    }
    throw error;
  }
}
