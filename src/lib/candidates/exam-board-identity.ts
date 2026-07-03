import type { CandidateExamIdentityStatus, Prisma } from "@/generated/prisma/client";
import { buildCandidateWhere, type CandidateListFilters } from "@/lib/candidates/list";
import {
  EXAM_BOARD_IDENTITY_EXPORT_COLUMNS,
  candidateExamIdentityStatusLabel,
  examBoardIdentityRowsToCsv,
  formatRegisteredAt,
  normalizeExamBoardIdentityInput,
  validateExamBoardIdentityInput,
  type ExamBoardIdentityInput,
  type ExamBoardIdentityRow,
} from "@/lib/candidates/exam-board-identity.shared";
import { buildPaginationMeta } from "@/lib/pagination";
import { containsFilter } from "@/lib/db/string-filters";
import { prisma } from "@/lib/prisma";

export {
  CANDIDATE_EXAM_IDENTITY_STATUS_OPTIONS,
  EXAM_BOARD_IDENTITY_EXPORT_COLUMNS,
  candidateExamIdentityStatusLabel,
  examBoardIdentityRules,
  examBoardIdentityRowsToCsv,
  examBoardRegistrationStatusLabel,
  examBoardSupportsUci,
  formatRegisteredAt,
  validateExamBoardIdentityInput,
  normalizeExamBoardIdentityInput,
  type ExamBoardIdentityInput,
  type ExamBoardIdentityRow,
  type ExamBoardIdentityRules,
} from "@/lib/candidates/exam-board-identity.shared";

export async function upsertCandidateExamIdentity(
  candidateId: string,
  examBoardId: string,
  input: ExamBoardIdentityInput,
  performedByUserId?: string,
) {
  const board = await prisma.examBoard.findUniqueOrThrow({
    where: { id: examBoardId },
    select: { code: true, name: true },
  });
  const errors = validateExamBoardIdentityInput(board.code, input, board.name);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const existing = await prisma.candidateExamIdentity.findUnique({
    where: { candidateId_examBoardId: { candidateId, examBoardId } },
    select: { status: true, registeredAt: true },
  });

  const normalized = normalizeExamBoardIdentityInput(board.code, input, board.name);
  const registeredAt =
    normalized.status === "REGISTERED"
      ? existing?.registeredAt ?? new Date()
      : existing?.registeredAt ?? null;

  const data = {
    centreNumber: normalized.centreNumber,
    candidateNumber: normalized.candidateNumber,
    uciNumber: normalized.uciNumber,
    status: normalized.status,
    registeredAt,
    notes: normalized.notes,
    updatedByUserId: performedByUserId ?? null,
  };

  return prisma.candidateExamIdentity.upsert({
    where: { candidateId_examBoardId: { candidateId, examBoardId } },
    create: {
      candidateId,
      examBoardId,
      ...data,
      createdByUserId: performedByUserId ?? null,
    },
    update: data,
    include: { examBoard: { select: { id: true, name: true, code: true } } },
  });
}

export async function archiveCandidateExamIdentity(
  candidateId: string,
  identityId: string,
  performedByUserId?: string,
) {
  const identity = await prisma.candidateExamIdentity.findFirst({
    where: { id: identityId, candidateId },
    select: { id: true, status: true },
  });
  if (!identity) throw new Error("Exam board identity not found");
  if (identity.status === "ARCHIVED") {
    throw new Error("Exam board identity is already archived");
  }

  return prisma.candidateExamIdentity.update({
    where: { id: identityId },
    data: {
      status: "ARCHIVED",
      updatedByUserId: performedByUserId ?? null,
    },
    include: { examBoard: { select: { id: true, name: true, code: true } } },
  });
}

export async function getCandidateExamIdentityForBoard(
  candidateId: string,
  examBoardId: string,
) {
  const identity = await prisma.candidateExamIdentity.findUnique({
    where: { candidateId_examBoardId: { candidateId, examBoardId } },
    include: { examBoard: { select: { id: true, name: true, code: true } } },
  });
  if (!identity || identity.status === "ARCHIVED") {
    return null;
  }
  return identity;
}

export async function assertCandidateExamBoardIdentityForRegistration(
  candidateId: string,
  examBoardId: string,
) {
  const identity = await getCandidateExamIdentityForBoard(candidateId, examBoardId);
  if (!identity) {
    throw new Error("No Exam Board Identity exists for this student.");
  }
  return identity;
}

function mapIdentityRow(
  candidate: {
    id: string;
    studentId: string;
    studentNumber: string | null;
    englishName: string;
    chineseName: string | null;
  },
  identity?: {
    id: string;
    examBoardId: string;
    centreNumber: string | null;
    candidateNumber: string | null;
    uciNumber: string | null;
    status: CandidateExamIdentityStatus;
    registeredAt: Date | null;
    notes: string | null;
    examBoard: { id: string; code: string; name: string };
  },
): ExamBoardIdentityRow {
  const candidateName = candidate.chineseName
    ? `${candidate.englishName} (${candidate.chineseName})`
    : candidate.englishName;

  if (!identity) {
    return {
      id: `${candidate.id}-empty`,
      candidateId: candidate.id,
      candidateName,
      studentId: candidate.studentId,
      schoolStudentNumber: candidate.studentNumber,
      chineseName: candidate.chineseName,
      englishName: candidate.englishName,
      examBoardId: "",
      examBoardCode: "—",
      examBoardName: "—",
      centreNumber: null,
      candidateNumber: null,
      uciNumber: null,
      status: "PENDING",
      registeredAt: null,
      notes: null,
    };
  }

  return {
    id: identity.id,
    candidateId: candidate.id,
    candidateName,
    studentId: candidate.studentId,
    schoolStudentNumber: candidate.studentNumber,
    chineseName: candidate.chineseName,
    englishName: candidate.englishName,
    examBoardId: identity.examBoardId,
    examBoardCode: identity.examBoard.code,
    examBoardName: identity.examBoard.name,
    centreNumber: identity.centreNumber,
    candidateNumber: identity.candidateNumber,
    uciNumber: identity.uciNumber,
    status: identity.status,
    registeredAt: identity.registeredAt ? identity.registeredAt.toISOString() : null,
    notes: identity.notes,
  };
}

export async function listExamBoardIdentityRows(
  filters: CandidateListFilters,
  page = 1,
  pageSize = 50,
) {
  const where = buildCandidateWhere(filters);
  const total = await prisma.candidate.count({ where });
  const { skip, page: safePage, totalPages } = buildPaginationMeta(total, page, pageSize);

  const candidates = await prisma.candidate.findMany({
    where,
    orderBy: [{ englishName: "asc" }],
    skip,
    take: pageSize,
    select: {
      id: true,
      studentId: true,
      studentNumber: true,
      englishName: true,
      chineseName: true,
      examIdentities: {
        include: { examBoard: { select: { id: true, code: true, name: true } } },
        orderBy: { examBoard: { name: "asc" } },
      },
    },
  });

  const rows = candidates.flatMap((candidate) => {
    if (candidate.examIdentities.length === 0) {
      return [mapIdentityRow(candidate)];
    }
    return candidate.examIdentities.map((identity) => mapIdentityRow(candidate, identity));
  });

  return {
    rows,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export async function exportExamBoardIdentityRows(filters: CandidateListFilters) {
  const result = await listExamBoardIdentityRows(filters, 1, 10_000);
  return result.rows
    .filter((row) => row.examBoardId)
    .map((row) => ({
      "Student ID": row.studentId ?? "",
      "School Student Number": row.schoolStudentNumber ?? "",
      "Chinese Name": row.chineseName ?? "",
      "English Name": row.englishName,
      "Exam Board": row.examBoardName,
      "Centre Number": row.centreNumber ?? "",
      "Candidate Number": row.candidateNumber ?? "",
      "UCI Number": row.uciNumber ?? "",
      Status: candidateExamIdentityStatusLabel(row.status),
      "Registered At": formatRegisteredAt(row.registeredAt),
    }));
}

export function buildExamBoardIdentitySearchWhere(q?: string): Prisma.CandidateWhereInput | undefined {
  if (!q?.trim()) return undefined;
  return {
    OR: [
      { englishName: containsFilter(q) },
      { chineseName: containsFilter(q) },
      { studentId: containsFilter(q) },
      { assessmentHubCandidateNumber: containsFilter(q) },
      { examIdentities: { some: { candidateNumber: containsFilter(q) } } },
      { examIdentities: { some: { uciNumber: containsFilter(q) } } },
      { examIdentities: { some: { centreNumber: containsFilter(q) } } },
    ],
  };
}
