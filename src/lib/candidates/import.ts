import type { Prisma } from "@/generated/prisma/client";
import { equalsFilter } from "@/lib/db/string-filters";
import { prisma } from "@/lib/prisma";
import { createCandidateAuditLog } from "@/lib/candidates/audit";
import { normalizeExamBoardKey } from "@/lib/candidates/exam-board-identity.shared";
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
  examBoard?: string;
  centreNumber?: string;
  uci?: string;
  boardCandidateNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  externalId?: string;
  schoolName?: string;
}

/** Friendly CSV header aliases → Canonical field names. */
const IMPORT_FIELD_ALIASES: Record<string, keyof CandidateImportRow> = {
  chinesename: "chineseName",
  "chinese name": "chineseName",
  surnamepinyin: "surnamePinyin",
  "surname pinyin": "surnamePinyin",
  "pinyin surname": "surnamePinyin",
  拼音姓: "surnamePinyin",
  givennamepinyin: "givenNamePinyin",
  "given name pinyin": "givenNamePinyin",
  "pinyin given name": "givenNamePinyin",
  拼音名: "givenNamePinyin",
  preferredenglishname: "preferredEnglishName",
  "preferred english name": "preferredEnglishName",
  firstname: "firstName",
  "first name": "firstName",
  lastname: "lastName",
  "last name": "lastName",
  legalenglishname: "legalEnglishName",
  "legal english name": "legalEnglishName",
  englishname: "englishName",
  "english name": "englishName",
  gender: "gender",
  dateofbirth: "dateOfBirth",
  "date of birth": "dateOfBirth",
  dob: "dateOfBirth",
  nationality: "nationality",
  iddocumenttype: "idDocumentType",
  "id document type": "idDocumentType",
  iddocumentnumber: "idDocumentNumber",
  "id document number": "idDocumentNumber",
  "id / passport number": "idDocumentNumber",
  email: "email",
  phone: "phone",
  candidatetype: "candidateType",
  "candidate type": "candidateType",
  studentnumber: "studentNumber",
  "student number": "studentNumber",
  "school student number": "studentNumber",
  grade: "grade",
  classname: "className",
  "class name": "className",
  graduationyear: "graduationYear",
  "graduation year": "graduationYear",
  assessmenthubcandidatenumber: "assessmentHubCandidateNumber",
  "assessment hub candidate number": "assessmentHubCandidateNumber",
  examboard: "examBoard",
  "exam board": "examBoard",
  centrenumber: "centreNumber",
  "centre number": "centreNumber",
  "center number": "centreNumber",
  uci: "uci",
  ucinumber: "uci",
  "uci number": "uci",
  boardcandidatenumber: "boardCandidateNumber",
  "board candidate number": "boardCandidateNumber",
  candidatenumber: "boardCandidateNumber",
  "candidate number": "boardCandidateNumber",
  "cand no": "boardCandidateNumber",
  "cand. no": "boardCandidateNumber",
  emergencycontactname: "emergencyContactName",
  "emergency contact name": "emergencyContactName",
  emergencycontactphone: "emergencyContactPhone",
  "emergency contact phone": "emergencyContactPhone",
  externalid: "externalId",
  "external id": "externalId",
  schoolname: "schoolName",
  "school name": "schoolName",
};

function normalizeImportHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

/** Map a pasted/uploaded row (any header casing/aliases) onto CandidateImportRow. */
export function normalizeCandidateImportRow(
  raw: Record<string, string | undefined>,
): CandidateImportRow {
  const row: CandidateImportRow = {};
  for (const [key, value] of Object.entries(raw)) {
    const canonical =
      IMPORT_FIELD_ALIASES[normalizeImportHeader(key)] ??
      (key as keyof CandidateImportRow);
    if (canonical && value !== undefined) {
      (row as Record<string, string | undefined>)[canonical] = value;
    }
  }
  return row;
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
    schoolName: row.schoolName?.trim() || null,
  };
}

async function resolveExamBoardForImport(examBoardText?: string | null) {
  const boards = await prisma.examBoard.findMany({
    select: { id: true, code: true, name: true, centreNumber: true },
    orderBy: { name: "asc" },
  });
  if (boards.length === 0) return null;

  const text = examBoardText?.trim();
  if (text) {
    const needle = text.toLowerCase();
    const exact =
      boards.find((board) => board.code.toLowerCase() === needle) ||
      boards.find((board) => board.name.toLowerCase() === needle);
    if (exact) return exact;

    const byKey = boards.find(
      (board) => normalizeExamBoardKey(board.code, board.name) === normalizeExamBoardKey(text, text),
    );
    if (byKey) return byKey;

    const partial = boards.find(
      (board) =>
        board.name.toLowerCase().includes(needle) || board.code.toLowerCase().includes(needle),
    );
    if (partial) return partial;
    return null;
  }

  return (
    boards.find((board) => normalizeExamBoardKey(board.code, board.name) === "EDEXCEL") ??
    boards[0]
  );
}

async function upsertBoardIdentityFromImportRow(
  candidateId: string,
  row: CandidateImportRow,
  performedById?: string,
) {
  const hasBoardFields = Boolean(
    row.uci?.trim() ||
      row.boardCandidateNumber?.trim() ||
      row.centreNumber?.trim() ||
      row.examBoard?.trim(),
  );
  if (!hasBoardFields) return;

  const board = await resolveExamBoardForImport(row.examBoard);
  if (!board) {
    throw new Error(
      row.examBoard?.trim()
        ? `Exam Board not found: ${row.examBoard.trim()}`
        : "No exam board configured for UCI / Candidate Number import",
    );
  }

  const centreNumber = row.centreNumber?.trim() || board.centreNumber?.trim() || null;
  await upsertCandidateExamIdentity(
    candidateId,
    board.id,
    {
      centreNumber,
      uciNumber: row.uci?.trim() || null,
      candidateNumber: row.boardCandidateNumber?.trim() || null,
      status: "PENDING",
    },
    performedById,
  );
}

async function findExistingExternalCandidate(row: CandidateImportRow) {
  const externalId = row.externalId?.trim();
  if (externalId) {
    const byExternalId = await prisma.candidate.findFirst({
      where: { candidateType: "EXTERNAL", externalId: equalsFilter(externalId) },
    });
    if (byExternalId) return byExternalId;
  }

  const hubNumber = row.assessmentHubCandidateNumber?.trim();
  if (hubNumber) {
    const byHub = await prisma.candidate.findFirst({
      where: {
        candidateType: "EXTERNAL",
        assessmentHubCandidateNumber: equalsFilter(hubNumber),
      },
    });
    if (byHub) return byHub;
  }

  const idDocumentNumber = row.idDocumentNumber?.trim();
  if (idDocumentNumber) {
    const byIdDoc = await prisma.candidate.findFirst({
      where: {
        candidateType: "EXTERNAL",
        idDocumentNumber: equalsFilter(idDocumentNumber),
      },
    });
    if (byIdDoc) return byIdDoc;
  }

  return null;
}

export async function importCandidates(
  rows: CandidateImportRow[],
  options?: { markMissingInactive?: boolean; performedById?: string },
) {
  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const seenStudentNumbers = new Set<string>();

  for (const [index, rawRow] of rows.entries()) {
    const row = normalizeCandidateImportRow(rawRow as Record<string, string | undefined>);
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
        await upsertBoardIdentityFromImportRow(candidate.id, row, options?.performedById);
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
        const existing = await findExistingExternalCandidate(row);
        if (existing) {
          const candidate = await prisma.candidate.update({
            where: { id: existing.id },
            data: {
              ...identityData,
              candidateType: "EXTERNAL",
              schoolName: identityInput.schoolName ?? existing.schoolName,
              externalId: row.externalId?.trim() || existing.externalId,
              sourceSystem: existing.sourceSystem || "IMPORT",
            },
          });
          await upsertBoardIdentityFromImportRow(candidate.id, row, options?.performedById);
          if (options?.performedById) {
            await createCandidateAuditLog({
              candidateId: candidate.id,
              action: "CANDIDATE_IDENTITY_UPDATED",
              performedById: options.performedById,
              metadata: { source: "import", candidateType: "EXTERNAL" },
            });
          }
          results.updated += 1;
          continue;
        }

        const created = await createExternalCandidate({
          ...identityInput,
          legalEnglishName: identityInput.legalEnglishName ?? undefined,
          assessmentHubCandidateNumber: identityInput.assessmentHubCandidateNumber ?? undefined,
          externalId: row.externalId,
          schoolName: identityInput.schoolName,
          sourceSystem: "IMPORT",
        });
        await upsertBoardIdentityFromImportRow(created.id, row, options?.performedById);
        if (options?.performedById) {
          await createCandidateAuditLog({
            candidateId: created.id,
            action: "CANDIDATE_IDENTITY_UPDATED",
            performedById: options.performedById,
            metadata: { source: "import", candidateType: "EXTERNAL", created: true },
          });
        }
        results.created += 1;
        continue;
      }

      const createdInternal = await prisma.candidate.create({
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
      await upsertBoardIdentityFromImportRow(createdInternal.id, row, options?.performedById);
      results.created += 1;
    } catch (error) {
      results.errors.push(
        `Row ${index + 1}: ${error instanceof Error ? error.message : "Import failed"}`,
      );
      results.skipped += 1;
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

/** One-row sample CSV for External + board identity import. */
export function buildExternalCandidateImportSampleCsv(): string {
  const headers = [
    "candidateType",
    "chineseName",
    "surnamePinyin",
    "givenNamePinyin",
    "preferredEnglishName",
    "gender",
    "dateOfBirth",
    "idDocumentType",
    "idDocumentNumber",
    "email",
    "phone",
    "examBoard",
    "centreNumber",
    "uci",
    "boardCandidateNumber",
    "externalId",
    "schoolName",
  ];
  const sample = [
    "EXTERNAL",
    "张三",
    "ZHANG",
    "San",
    "Sam",
    "MALE",
    "2010-05-15",
    "PASSPORT",
    "E12345678",
    "sam.zhang@example.com",
    "13800000000",
    "Pearson Edexcel",
    "96834",
    "96834B990001",
    "T00001",
    "EXT-2026-001",
    "Partner School",
  ];
  return `${headers.join(",")}\n${sample.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")}\n`;
}

export { CANDIDATE_IMPORT_HEADERS };

export {
  upsertCandidateExamIdentity,
  type ExamBoardIdentityInput,
} from "@/lib/candidates/exam-board-identity";

export async function updateCandidate(id: string, data: Prisma.CandidateUpdateInput) {
  return prisma.candidate.update({ where: { id }, data });
}
