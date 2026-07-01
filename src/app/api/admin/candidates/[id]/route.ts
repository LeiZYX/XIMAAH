import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { createCandidateAuditLog } from "@/lib/candidates/audit";
import { updateCandidate, upsertCandidateExamIdentity } from "@/lib/candidates/import";
import { getCandidateById } from "@/lib/candidates/list";
import {
  buildCandidateIdentityUpdate,
  sanitizeCandidateForRole,
  validateCandidateIdentity,
  type CandidateIdentityInput,
} from "@/lib/candidates/identity";
import { backfillCandidatesFromStudents } from "@/lib/candidates/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER", "SUBJECT_TEACHER", "STUDENT"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const candidate = await getCandidateById(id);
  if (!candidate) return jsonError("Candidate not found", 404);

  if (auth.user.role === "STUDENT") {
    const own = candidate.userId === auth.user.id;
    if (!own) return jsonError("Forbidden", 403);
  }

  return NextResponse.json(sanitizeCandidateForRole(candidate, auth.user.role));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const existing = await getCandidateById(id);
  if (!existing) return jsonError("Candidate not found", 404);

  const body = await request.json();
  const data = parseJsonBody<{
    identity?: CandidateIdentityInput;
    loginEnabled?: boolean;
    removePhoto?: boolean;
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

  if ("studentId" in (body as object)) {
    return jsonError("Student ID cannot be changed", 400);
  }

  try {
    if (data.examIdentity?.examBoardId) {
      await upsertCandidateExamIdentity(id, data.examIdentity.examBoardId, {
        centreNumber: data.examIdentity.centreNumber ?? null,
        boardCandidateNumber: data.examIdentity.boardCandidateNumber ?? null,
        uci: data.examIdentity.uci ?? null,
        notes: data.examIdentity.notes ?? null,
      });
    }

    if (data.identity) {
      const merged: CandidateIdentityInput = {
        chineseName: data.identity.chineseName ?? existing.chineseName,
        surnamePinyin: data.identity.surnamePinyin ?? existing.surnamePinyin,
        givenNamePinyin: data.identity.givenNamePinyin ?? existing.givenNamePinyin,
        preferredEnglishName:
          data.identity.preferredEnglishName ?? existing.preferredEnglishName,
        legalEnglishName: data.identity.legalEnglishName ?? existing.legalEnglishName,
        gender: data.identity.gender ?? existing.gender,
        dateOfBirth: data.identity.dateOfBirth ?? existing.dateOfBirth,
        nationality: data.identity.nationality ?? existing.nationality,
        idDocumentType: data.identity.idDocumentType ?? existing.idDocumentType,
        idDocumentNumber: data.identity.idDocumentNumber ?? existing.idDocumentNumber,
        email: data.identity.email ?? existing.email,
        phone: data.identity.phone ?? existing.phone,
        emergencyContactName:
          data.identity.emergencyContactName ?? existing.emergencyContactName,
        emergencyContactPhone:
          data.identity.emergencyContactPhone ?? existing.emergencyContactPhone,
        studentNumber: data.identity.studentNumber ?? existing.studentNumber,
        grade: data.identity.grade ?? existing.grade,
        className: data.identity.className ?? existing.className,
        graduationYear: data.identity.graduationYear ?? existing.graduationYear,
        assessmentHubCandidateNumber:
          data.identity.assessmentHubCandidateNumber ?? existing.assessmentHubCandidateNumber,
        status: data.identity.status ?? existing.status,
      };

      const validationErrors = validateCandidateIdentity(merged);
      if (validationErrors.length > 0) {
        return jsonError(validationErrors.join("; "), 400);
      }

      const updateData = buildCandidateIdentityUpdate(merged);
      const { studentNumber, grade, className, graduationYear, ...sharedUpdate } = updateData;

      await updateCandidate(id, {
        ...sharedUpdate,
        ...(existing.candidateType === "INTERNAL"
          ? { studentNumber, grade, className, graduationYear }
          : {}),
        ...(data.loginEnabled !== undefined ? { loginEnabled: data.loginEnabled } : {}),
      });

      const nameChanged =
        existing.englishName !== updateData.englishName ||
        existing.legalEnglishName !== updateData.legalEnglishName ||
        existing.preferredEnglishName !== updateData.preferredEnglishName;
      const documentChanged = existing.idDocumentNumber !== updateData.idDocumentNumber;

      await createCandidateAuditLog({
        candidateId: id,
        action: "CANDIDATE_IDENTITY_UPDATED",
        performedById: auth.user.id,
      });
      if (nameChanged) {
        await createCandidateAuditLog({
          candidateId: id,
          action: "CANDIDATE_NAME_CHANGED",
          performedById: auth.user.id,
          metadata: {
            before: existing.englishName,
            after: updateData.englishName,
          },
        });
      }
      if (documentChanged) {
        await createCandidateAuditLog({
          candidateId: id,
          action: "DOCUMENT_NUMBER_CHANGED",
          performedById: auth.user.id,
        });
      }
    } else if (data.loginEnabled !== undefined) {
      await updateCandidate(id, { loginEnabled: data.loginEnabled });
    }

    const candidate = await getCandidateById(id);
    return NextResponse.json(candidate);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Update failed", 500);
  }
}
