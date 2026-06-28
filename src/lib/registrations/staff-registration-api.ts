import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { RegistrationError } from "@/lib/registrations/errors";
import {
  applyAssistedRegistration,
  applyExternalCandidateRegistration,
  applyOfficeOnlyInternalRegistration,
} from "@/lib/registrations/workflows";

function parseInternalBody(body: unknown) {
  return parseJsonBody<{
    candidateId?: string;
    studentId?: string;
    registrationWindowId?: string;
    examSessionIds?: string[];
    reason?: string;
  }>(body, []);
}

export async function createAssistedHandler(request: NextRequest, role: "ADMIN" | "EXAM_OFFICER") {
  const auth = await requireAuth([role]);
  if (auth.error) return auth.error;

  const data = parseInternalBody(await request.json());
  if ((!data?.candidateId && !data?.studentId) || !data.registrationWindowId || !data.reason?.trim()) {
    return jsonError("candidateId (or studentId), registrationWindowId, and reason are required", 400);
  }

  const examSessionIds = Array.isArray(data.examSessionIds) ? data.examSessionIds : [];
  if (examSessionIds.length === 0) {
    return jsonError("At least one exam session must be selected", 400);
  }

  try {
    const workspace = await applyAssistedRegistration(
      { id: auth.user.id, role: auth.user.role },
      {
        candidateId: data.candidateId,
        studentId: data.studentId,
        registrationWindowId: data.registrationWindowId,
        examSessionIds,
        reason: data.reason.trim(),
      },
    );
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) return jsonError(error.message, error.status);
    throw error;
  }
}

export async function createOfficeOnlyInternalHandler(
  request: NextRequest,
  role: "ADMIN" | "EXAM_OFFICER",
) {
  const auth = await requireAuth([role]);
  if (auth.error) return auth.error;

  const data = parseInternalBody(await request.json());
  if ((!data?.candidateId && !data?.studentId) || !data.registrationWindowId || !data.reason?.trim()) {
    return jsonError("candidateId (or studentId), registrationWindowId, and reason are required", 400);
  }

  const examSessionIds = Array.isArray(data.examSessionIds) ? data.examSessionIds : [];
  if (examSessionIds.length === 0) {
    return jsonError("At least one exam session must be selected", 400);
  }

  try {
    const workspace = await applyOfficeOnlyInternalRegistration(
      { id: auth.user.id, role: auth.user.role },
      {
        candidateId: data.candidateId,
        studentId: data.studentId,
        registrationWindowId: data.registrationWindowId,
        examSessionIds,
        reason: data.reason.trim(),
      },
    );
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) return jsonError(error.message, error.status);
    throw error;
  }
}

export async function createExternalCandidateRegistrationHandler(
  request: NextRequest,
  role: "ADMIN" | "EXAM_OFFICER",
) {
  const auth = await requireAuth([role]);
  if (auth.error) return auth.error;

  const data = parseJsonBody<{
    candidateId?: string;
    newCandidate?: Record<string, string | undefined>;
    registrationWindowId?: string;
    examSessionIds?: string[];
    reason?: string;
  }>(await request.json(), []);

  if (!data?.registrationWindowId || !data.reason?.trim()) {
    return jsonError("registrationWindowId and reason are required", 400);
  }
  if (!data.candidateId && !data.newCandidate?.englishName?.trim()) {
    return jsonError("Select an existing external candidate or provide new candidate details", 400);
  }

  const examSessionIds = Array.isArray(data.examSessionIds) ? data.examSessionIds : [];
  if (examSessionIds.length === 0) {
    return jsonError("At least one exam session must be selected", 400);
  }

  try {
    const workspace = await applyExternalCandidateRegistration(
      { id: auth.user.id, role: auth.user.role },
      {
        candidateId: data.candidateId,
        newCandidate: data.newCandidate as never,
        registrationWindowId: data.registrationWindowId,
        examSessionIds,
        reason: data.reason.trim(),
      },
    );
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) return jsonError(error.message, error.status);
    throw error;
  }
}
