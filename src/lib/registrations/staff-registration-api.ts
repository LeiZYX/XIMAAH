import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { RegistrationError } from "@/lib/registrations/errors";
import {
  apiErrorMessage,
  parseStaffRegistrationMetadata,
} from "@/lib/registrations/staff-registration-payload";
import {
  applyInternalAssistedRegistration,
} from "@/lib/registrations/internal-assisted-registration";
import {
  applyRestrictedInternalRegistration,
} from "@/lib/registrations/restricted-internal-registration";
import {
  registerExternalCandidate,
} from "@/lib/registrations/external-candidate-registration";

function parseInternalBody(body: unknown) {
  return parseJsonBody<{
    candidateId?: string;
    studentId?: string;
    registrationWindowId?: string;
    examSessionIds?: string[];
    reason?: string;
    includeCandidateRegistrationFee?: boolean;
    candidateRegistrationFeeReason?: string;
    registrationType?: string;
    billingScope?: string;
    visibility?: string;
    registrationSource?: string;
  }>(body, []);
}

function handleStaffRegistrationError(error: unknown) {
  if (error instanceof RegistrationError) return jsonError(error.message, error.status);
  console.error("Staff registration failed", error);
  return jsonError(apiErrorMessage(error), 500);
}

export async function createAssistedHandler(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
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
    if (data.includeCandidateRegistrationFee && !data.candidateRegistrationFeeReason?.trim()) {
      return jsonError("Reason for adding Candidate Registration Fee is required", 400);
    }

    const workspace = await applyInternalAssistedRegistration(
      { id: auth.user.id, role: auth.user.role },
      {
        candidateId: data.candidateId,
        studentId: data.studentId,
        registrationWindowId: data.registrationWindowId,
        examSessionIds,
        reason: data.reason.trim(),
        includeCandidateRegistrationFee: data.includeCandidateRegistrationFee,
        candidateRegistrationFeeReason: data.candidateRegistrationFeeReason,
      },
    );
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    return handleStaffRegistrationError(error);
  }
}

export async function createOfficeOnlyInternalHandler(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
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
    parseStaffRegistrationMetadata(data);

    if (data.includeCandidateRegistrationFee && !data.candidateRegistrationFeeReason?.trim()) {
      return jsonError("Reason for adding Candidate Registration Fee is required", 400);
    }

    const workspace = await applyRestrictedInternalRegistration(
      { id: auth.user.id, role: auth.user.role },
      {
        candidateId: data.candidateId,
        studentId: data.studentId,
        registrationWindowId: data.registrationWindowId,
        examSessionIds,
        reason: data.reason.trim(),
        includeCandidateRegistrationFee: data.includeCandidateRegistrationFee,
        candidateRegistrationFeeReason: data.candidateRegistrationFeeReason,
      },
    );
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    return handleStaffRegistrationError(error);
  }
}

export async function createExternalCandidateRegistrationHandler(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const data = parseJsonBody<{
    candidateId?: string;
    newCandidate?: Record<string, string | undefined>;
    registrationWindowId?: string;
    examSessionIds?: string[];
    reason?: string;
    includeCandidateRegistrationFee?: boolean;
    candidateRegistrationFeeReason?: string;
    candidateType?: string;
    registrationType?: string;
    billingScope?: string;
    visibility?: string;
    registrationSource?: string;
  }>(await request.json(), []);

  if (!data?.registrationWindowId) {
    return jsonError("registrationWindowId is required", 400);
  }
  if (!data.candidateId && !data.newCandidate?.englishName?.trim()) {
    return jsonError("Select an existing external candidate or provide new candidate details", 400);
  }

  const examSessionIds = Array.isArray(data.examSessionIds) ? data.examSessionIds : [];
  if (examSessionIds.length === 0) {
    return jsonError("At least one exam session must be selected", 400);
  }
  if (!data.reason?.trim()) {
    return jsonError("Reason is required", 400);
  }
  if (data.candidateType && data.candidateType !== "EXTERNAL") {
    return jsonError("External registration requires candidateType EXTERNAL", 400);
  }

  try {
    parseStaffRegistrationMetadata(data);

    if (data.includeCandidateRegistrationFee && !data.candidateRegistrationFeeReason?.trim()) {
      return jsonError("Reason for adding Candidate Registration Fee is required", 400);
    }

    const workspace = await registerExternalCandidate(
      { id: auth.user.id, role: auth.user.role },
      {
        candidateId: data.candidateId,
        newCandidate: data.newCandidate as never,
        registrationWindowId: data.registrationWindowId,
        examSessionIds,
        reason: data.reason?.trim() || undefined,
        includeCandidateRegistrationFee: data.includeCandidateRegistrationFee,
        candidateRegistrationFeeReason: data.candidateRegistrationFeeReason,
      },
    );
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    return handleStaffRegistrationError(error);
  }
}
