import type { CandidateStatus, CandidateType, Grade, Prisma } from "@/generated/prisma/client";
import { ensureInternalCandidatesSynced } from "@/lib/candidates/service";
import { backfillMissingStudentIds } from "@/lib/candidates/student-id";
import { buildPaginationMeta } from "@/lib/pagination";
import { containsFilter } from "@/lib/db/string-filters";
import { prisma } from "@/lib/prisma";
import {
  GRADE_LABELS,
  GRADE_VALUES,
  GENDER_LABELS,
  parseGradeInput,
  type GradeValue,
  type GenderValue,
} from "@/lib/students/profile-enums";

export type StudentOverviewGradeBucket = {
  grade: GradeValue | "UNASSIGNED";
  label: string;
  count: number;
};

export type StudentOverviewSummary = {
  candidateType: CandidateType;
  status: CandidateStatus | "ALL";
  total: number;
  byGrade: StudentOverviewGradeBucket[];
};

export type StudentOverviewRow = {
  id: string;
  studentId: string;
  assessmentHubCandidateNumber: string;
  studentNumber: string | null;
  englishName: string;
  chineseName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  genderLabel: string | null;
  grade: string | null;
  gradeLabel: string | null;
  className: string | null;
  schoolName: string | null;
  email: string | null;
  phone: string | null;
  uciNumber: string | null;
  uciByBoard: Array<{ boardCode: string; boardName: string; uciNumber: string }>;
  status: string;
};

export type StudentOverviewFilters = {
  candidateType?: CandidateType;
  status?: CandidateStatus | "ALL";
  grade?: Grade | "UNASSIGNED" | string;
  q?: string;
};

function buildOverviewWhere(filters: StudentOverviewFilters): Prisma.CandidateWhereInput {
  const where: Prisma.CandidateWhereInput = {
    candidateType: filters.candidateType ?? "INTERNAL",
  };

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status;
  } else if (!filters.status) {
    where.status = "ACTIVE";
  }

  if (filters.grade === "UNASSIGNED") {
    where.grade = null;
  } else if (filters.grade) {
    const grade =
      typeof filters.grade === "string" ? parseGradeInput(filters.grade) : filters.grade;
    if (grade) where.grade = grade;
  }

  if (filters.q?.trim()) {
    const q = containsFilter(filters.q.trim());
    where.OR = [
      { englishName: q },
      { chineseName: q },
      { studentNumber: q },
      { studentId: q },
      { assessmentHubCandidateNumber: q },
      { email: q },
      {
        examIdentities: {
          some: { uciNumber: q },
        },
      },
    ];
  }

  return where;
}

function formatDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function genderLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value in GENDER_LABELS) return GENDER_LABELS[value as GenderValue];
  return value;
}

function gradeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value in GRADE_LABELS) return GRADE_LABELS[value as GradeValue];
  return value;
}

function mapOverviewRow(candidate: {
  id: string;
  studentId: string;
  assessmentHubCandidateNumber: string;
  studentNumber: string | null;
  englishName: string;
  chineseName: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  grade: string | null;
  className: string | null;
  schoolName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  examIdentities: Array<{
    uciNumber: string | null;
    examBoard: { code: string; name: string };
  }>;
}): StudentOverviewRow {
  const uciByBoard = candidate.examIdentities
    .filter((row) => Boolean(row.uciNumber?.trim()))
    .map((row) => ({
      boardCode: row.examBoard.code,
      boardName: row.examBoard.name,
      uciNumber: row.uciNumber!.trim(),
    }));

  const edexcelUci =
    uciByBoard.find((row) => {
      const code = row.boardCode.toUpperCase();
      return code === "EDEXCEL" || code === "PEARSON";
    })?.uciNumber ?? null;

  return {
    id: candidate.id,
    studentId: candidate.studentId,
    assessmentHubCandidateNumber: candidate.assessmentHubCandidateNumber,
    studentNumber: candidate.studentNumber,
    englishName: candidate.englishName,
    chineseName: candidate.chineseName,
    dateOfBirth: formatDateOnly(candidate.dateOfBirth),
    gender: candidate.gender,
    genderLabel: genderLabel(candidate.gender),
    grade: candidate.grade,
    gradeLabel: gradeLabel(candidate.grade),
    className: candidate.className,
    schoolName: candidate.schoolName,
    email: candidate.email,
    phone: candidate.phone,
    uciNumber: edexcelUci ?? uciByBoard[0]?.uciNumber ?? null,
    uciByBoard,
    status: candidate.status,
  };
}

export async function getStudentOverviewSummary(
  filters: Omit<StudentOverviewFilters, "grade" | "q"> = {},
): Promise<StudentOverviewSummary> {
  await ensureInternalCandidatesSynced();
  await backfillMissingStudentIds().catch(() => undefined);

  const candidateType = filters.candidateType ?? "INTERNAL";
  const status = filters.status ?? "ACTIVE";
  const where = buildOverviewWhere({ candidateType, status });

  const [total, grouped] = await Promise.all([
    prisma.candidate.count({ where }),
    prisma.candidate.groupBy({
      by: ["grade"],
      where,
      _count: { _all: true },
    }),
  ]);

  const countByGrade = new Map<string | null, number>();
  for (const row of grouped) {
    countByGrade.set(row.grade, row._count._all);
  }

  const byGrade: StudentOverviewGradeBucket[] = GRADE_VALUES.map((grade) => ({
    grade,
    label: GRADE_LABELS[grade],
    count: countByGrade.get(grade) ?? 0,
  }));

  const unassigned = countByGrade.get(null) ?? 0;
  if (unassigned > 0) {
    byGrade.push({
      grade: "UNASSIGNED",
      label: "Unassigned",
      count: unassigned,
    });
  }

  return {
    candidateType,
    status,
    total,
    byGrade,
  };
}

export async function listStudentOverviewRows(
  filters: StudentOverviewFilters,
  page = 1,
  pageSize = 50,
) {
  await ensureInternalCandidatesSynced();
  await backfillMissingStudentIds().catch(() => undefined);

  const where = buildOverviewWhere(filters);
  const total = await prisma.candidate.count({ where });
  const { skip, page: safePage, totalPages } = buildPaginationMeta(total, page, pageSize);

  const candidates = await prisma.candidate.findMany({
    where,
    orderBy: [{ grade: "asc" }, { className: "asc" }, { englishName: "asc" }],
    skip,
    take: pageSize,
    select: {
      id: true,
      studentId: true,
      assessmentHubCandidateNumber: true,
      studentNumber: true,
      englishName: true,
      chineseName: true,
      dateOfBirth: true,
      gender: true,
      grade: true,
      className: true,
      schoolName: true,
      email: true,
      phone: true,
      status: true,
      examIdentities: {
        where: { uciNumber: { not: null } },
        select: {
          uciNumber: true,
          examBoard: { select: { code: true, name: true } },
        },
      },
    },
  });

  return {
    students: candidates.map(mapOverviewRow),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export function parseStudentOverviewFilters(
  searchParams: URLSearchParams,
): StudentOverviewFilters {
  const type = searchParams.get("candidateType")?.toUpperCase();
  const statusParam = searchParams.get("status")?.toUpperCase();
  const gradeRaw = searchParams.get("grade")?.trim();

  let status: CandidateStatus | "ALL" | undefined;
  if (statusParam === "ALL") status = "ALL";
  else if (
    statusParam === "ACTIVE" ||
    statusParam === "GRADUATED" ||
    statusParam === "LEFT" ||
    statusParam === "INACTIVE"
  ) {
    status = statusParam;
  } else if (statusParam == null) {
    status = "ACTIVE";
  }

  let grade: StudentOverviewFilters["grade"];
  if (!gradeRaw || gradeRaw.toUpperCase() === "ALL") {
    grade = undefined;
  } else if (gradeRaw.toUpperCase() === "UNASSIGNED") {
    grade = "UNASSIGNED";
  } else {
    grade = gradeRaw;
  }

  return {
    candidateType: type === "EXTERNAL" ? "EXTERNAL" : "INTERNAL",
    status,
    grade,
    q: searchParams.get("q")?.trim() || undefined,
  };
}
