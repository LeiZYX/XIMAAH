import type { Prisma } from "@/generated/prisma/client";
import { equalsFilter } from "@/lib/db/string-filters";
import { prisma } from "@/lib/prisma";
import { createCandidateAuditLog } from "@/lib/candidates/audit";
import {
  CANDIDATE_IMPORT_HEADERS,
  parseCandidateTypeInput,
  parseGenderInput,
  parseIdDocumentTypeInput,
} from "@/lib/candidates/export";
import { parseGradeInput } from "@/lib/students/profile-enums";
import {
  buildCandidateIdentityUpdate,
  parseDateOfBirth,
  resolveSyncedNameParts,
  validateCandidateIdentity,
} from "@/lib/candidates/identity";
import { upsertCandidateExamIdentity } from "@/lib/candidates/exam-board-identity";
import {
  createExternalCandidate,
  generateAssessmentHubCandidateNumber,
  syncCandidateFromStudentUser,
} from "@/lib/candidates/service";
import { generateStudentId } from "@/lib/candidates/student-id";

export interface CandidateImportRow {
  chineseName?: string;
  surnamePinyin?: string;
  givenNamePinyin?: string;
  preferredEnglishName?: string;
  firstName?: string;
  lastName?: string;
  legalEnglishName?: string;
  englishName?: string;
  gender?: string;
  dateOfBirth?: string;
  nationality?: string;
  idDocumentType?: string;
  idDocumentNumber?: string;
  email?: string;
  phone?: string;
  candidateType?: string;
  studentNumber?: string;
  grade?: string;
  className?: string;
  graduationYear?: string;
  assessmentHubCandidateNumber?: string;
  uci?: string;
  boardCandidateNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  externalId?: string;
}

function rowToIdentityInput(row: CandidateImportRow) {
  const synced = resolveSyncedNameParts({
    firstName: row.firstName,
    lastName: row.lastName,
    givenNamePinyin: row.givenNamePinyin,
    surnamePinyin: row.surnamePinyin,
  });
  let firstName = synced.firstName;
  let lastName = synced.lastName;
  const legalEnglishName =
    row.legalEnglishName?.trim() ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    row.englishName?.trim() ||
    "";

  if ((!firstName || !lastName) && legalEnglishName) {
    const parts = legalEnglishName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      firstName = firstName || parts[0];
      lastName = lastName || parts[0];
    } else if (parts.length >= 2) {
      firstName = firstName || parts.slice(0, -1).join(" ");
      lastName = lastName || parts[parts.length - 1];
    }
  }

  const preferredEnglishName =
    row.preferredEnglishName?.trim() ||
    (row.englishName?.trim() &&
    row.englishName.trim().toUpperCase() !== [firstName, lastName].filter(Boolean).join(" ").toUpperCase()
      ? row.englishName.trim()
      : null) ||
    null;

  return {
    chineseName: row.chineseName?.trim() || null,
    surnamePinyin: lastName || null,
    givenNamePinyin: firstName || null,
    preferredEnglishName,
    firstName: firstName || null,
    lastName: lastName || null,
    legalEnglishName,
    gender: parseGenderInput(row.gender) ?? null,
    dateOfBirth: parseDateOfBirth(row.dateOfBirth),
    nationality: row.nationality?.trim() || null,
    idDocumentType: parseIdDocumentTypeInput(row.idDocumentType) ?? null,
    idDocumentNumber: row.idDocumentNumber?.trim() || null,
    email: row.email?.trim() || null,
    phone: row.phone?.trim() || null,
    studentNumber: row.studentNumber?.trim() || null,
    grade: parseGradeInput(row.grade) ?? null,
    className: row.className?.trim() || null,
    graduationYear: row.graduationYear ? Number(row.graduationYear) : null,
    assessmentHubCandidateNumber:
      row.assessmentHubCandidateNumber?.trim() || generateAssessmentHubCandidateNumber(),
    emergencyContactName: row.emergencyContactName?.trim() || null,
    emergencyContactPhone: row.emergencyContactPhone?.trim() || null,
  };
}

export async function importCandidates(
  rows: CandidateImportRow[],
  options?: { markMissingInactive?: boolean; performedById?: string },
) {
  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const seenStudentNumbers = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const candidateType = parseCandidateTypeInput(row.candidateType) ?? "INTERNAL";
    const identityInput = rowToIdentityInput(row);
    const validationErrors = validateCandidateIdentity(identityInput);
    if (validationErrors.length > 0) {
      results.errors.push(`Row ${index + 1}: ${validationErrors.join("; ")}`);
      results.skipped += 1;
      continue;
    }

    const studentNumber = row.studentNumber?.trim();
    if (candidateType === "INTERNAL" && studentNumber) {
      seenStudentNumbers.add(studentNumber.toLowerCase());
    }

    try {
      const identityData = buildCandidateIdentityUpdate({
        ...identityInput,
        assessmentHubCandidateNumber:
          identityInput.assessmentHubCandidateNumber?.trim() ||
          generateAssessmentHubCandidateNumber(),
      });
      const user =
        candidateType === "INTERNAL" && studentNumber
          ? await prisma.user.findFirst({
              where: { studentNo: equalsFilter(studentNumber) },
              include: { studentProfile: true, candidate: true },
            })
          : null;

      if (user?.studentProfile) {
        await syncCandidateFromStudentUser(user.id);
        const candidate = await prisma.candidate.update({
          where: { userId: user.id },
          data: {
            ...identityData,
            candidateType: "INTERNAL",
            externalId: row.externalId?.trim() || undefined,
            graduationYear: identityData.graduationYear ?? user.studentProfile.graduationYear,
          },
        });
        if (row.uci || row.boardCandidateNumber) {
          const board = await prisma.examBoard.findFirst({ orderBy: { name: "asc" } });
          if (board) {
            await upsertCandidateExamIdentity(candidate.id, board.id, {
              uciNumber: row.uci?.trim() || null,
              candidateNumber: row.boardCandidateNumber?.trim() || null,
            });
          }
        }
        if (options?.performedById) {
          await createCandidateAuditLog({
            candidateId: candidate.id,
            action: "CANDIDATE_IDENTITY_UPDATED",
            performedById: options.performedById,
            metadata: { source: "import" },
          });
        }
        results.updated += 1;
        continue;
      }

      if (candidateType === "EXTERNAL") {
        await createExternalCandidate({
          ...identityInput,
          legalEnglishName: identityInput.legalEnglishName ?? undefined,
          assessmentHubCandidateNumber: identityInput.assessmentHubCandidateNumber ?? undefined,
          externalId: row.externalId,
        });
        results.created += 1;
        continue;
      }

      await prisma.candidate.create({
        data: {
          studentId: await generateStudentId(),
          candidateType: "INTERNAL",
          ...identityData,
          loginEnabled: false,
          status: "ACTIVE",
          sourceSystem: "IMPORT",
          externalId: row.externalId?.trim() || null,
        },
      });
      results.created += 1;
    } catch (error) {
      results.errors.push(
        `Row ${index + 1}: ${error instanceof Error ? error.message : "Import failed"}`,
      );
    }
  }

  if (options?.markMissingInactive) {
    await prisma.candidate.updateMany({
      where: {
        candidateType: "INTERNAL",
        studentNumber: { not: null },
        NOT: {
          studentNumber: {
            in: [...seenStudentNumbers],
          },
        },
      },
      data: { status: "INACTIVE" },
    });
  }

  return results;
}

export async function importInternalCandidates(
  rows: CandidateImportRow[],
  options?: { markMissingInactive?: boolean; performedById?: string },
) {
  return importCandidates(
    rows.map((row) => ({ ...row, candidateType: row.candidateType ?? "INTERNAL" })),
    options,
  );
}

export { CANDIDATE_IMPORT_HEADERS };

export {
  upsertCandidateExamIdentity,
  type ExamBoardIdentityInput,
} from "@/lib/candidates/exam-board-identity";

export async function updateCandidate(id: string, data: Prisma.CandidateUpdateInput) {
  return prisma.candidate.update({ where: { id }, data });
}
