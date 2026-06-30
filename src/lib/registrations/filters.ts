import type { Prisma } from "@/generated/prisma/client";
import type { RegistrationType } from "@/generated/prisma/enums";
import { containsFilter } from "@/lib/db/string-filters";
import { AUTO_BILLING_SCOPES, STUDENT_VISIBLE, TEACHER_VISIBLE } from "@/lib/registrations/metadata";

export interface RegistrationListFilters {
  registrationWindowId?: string;
  examBoardId?: string;
  examSeriesId?: string;
  year?: number;
  month?: number;
  grade?: string;
  className?: string;
  subjectId?: string;
  status?: string;
  studentName?: string;
  studentNo?: string;
  registrationSource?: string;
  visibility?: string;
  billingScope?: string;
  registrationType?: string;
  registrationTypes?: string[];
  studentType?: string;
  candidateType?: string;
  assessmentHubCandidateNumber?: string;
}

export function buildRegistrationWhere(
  filters: RegistrationListFilters,
): Prisma.StudentExamRegistrationWhereInput {
  const where: Prisma.StudentExamRegistrationWhereInput = {};

  if (filters.registrationWindowId) where.registrationWindowId = filters.registrationWindowId;
  if (filters.examBoardId) where.examBoardId = filters.examBoardId;
  if (filters.examSeriesId) where.examSeriesId = filters.examSeriesId;
  if (filters.grade) where.gradeSnapshot = filters.grade;
  if (filters.className) where.classNameSnapshot = filters.className;
  if (filters.subjectId) where.subjectId = filters.subjectId;
  if (filters.status) where.status = filters.status as Prisma.EnumRegistrationStatusFilter;
  if (filters.registrationSource) {
    where.registrationSource = filters.registrationSource as Prisma.EnumRegistrationSourceFilter;
  }
  if (filters.visibility) {
    where.visibility = filters.visibility as Prisma.EnumRegistrationVisibilityFilter;
  }
  if (filters.billingScope) {
    where.billingScope = filters.billingScope as Prisma.EnumBillingScopeFilter;
  }
  if (filters.registrationType) {
    where.registrationType = filters.registrationType as Prisma.EnumRegistrationTypeFilter;
  }
  if (filters.registrationTypes?.length) {
    where.registrationType = {
      in: filters.registrationTypes as RegistrationType[],
    };
  }
  if (filters.studentType === "EXTERNAL") {
    where.registrationSource = "EXTERNAL_CANDIDATE";
  } else if (filters.studentType === "INTERNAL") {
    where.registrationSource = { not: "EXTERNAL_CANDIDATE" };
  }
  if (filters.candidateType === "INTERNAL") {
    where.candidateTypeSnapshot = "INTERNAL";
  } else if (filters.candidateType === "EXTERNAL") {
    where.candidateTypeSnapshot = "EXTERNAL";
  }
  if (filters.assessmentHubCandidateNumber) {
    where.assessmentHubCandidateNumberSnapshot = containsFilter(filters.assessmentHubCandidateNumber);
  }
  if (filters.studentNo) {
    where.studentNoSnapshot = containsFilter(filters.studentNo);
  }
  if (filters.studentName) {
    where.studentNameSnapshot = containsFilter(filters.studentName);
  }

  if (filters.year || filters.month) {
    where.examSession = {
      date: {
        ...(filters.year
          ? {
              gte: new Date(filters.year, (filters.month ?? 1) - 1, 1),
              lt: filters.month
                ? new Date(filters.year, filters.month, 1)
                : new Date(filters.year + 1, 0, 1),
            }
          : {}),
      },
    };
  }

  return where;
}

export function buildStudentVisibleRegistrationWhere(
  studentUserId: string,
): Prisma.StudentExamRegistrationWhereInput {
  return {
    status: { in: ["ACTIVE", "LOCKED"] },
    registrationType: "INTERNAL_NORMAL",
    visibleToStudent: true,
    visibleInStudentPortal: true,
    visibility: { in: STUDENT_VISIBLE },
    OR: [{ studentId: studentUserId }, { candidate: { userId: studentUserId } }],
  };
}

export function buildTeacherVisibleRegistrationWhere(
  base: Prisma.StudentExamRegistrationWhereInput,
): Prisma.StudentExamRegistrationWhereInput {
  return {
    AND: [
      base,
      { registrationType: "INTERNAL_NORMAL" },
      { visibleToTeacher: true },
      { visibleInTeacherPortal: true },
      { visibility: { in: TEACHER_VISIBLE } },
      {
        OR: [
          { candidateTypeSnapshot: "INTERNAL" },
          { candidateTypeSnapshot: null },
        ],
      },
    ],
  };
}

export function buildTeacherRegistrationWhere(
  filters: RegistrationListFilters,
): Prisma.StudentExamRegistrationWhereInput {
  const base = buildRegistrationWhere(filters);
  if (Object.keys(base).length === 0) {
    return buildTeacherVisibleRegistrationWhere({});
  }

  return buildTeacherVisibleRegistrationWhere(base);
}

export function parseRegistrationFilters(searchParams: URLSearchParams): RegistrationListFilters {
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  return {
    registrationWindowId: searchParams.get("registrationWindowId") || undefined,
    examBoardId: searchParams.get("examBoardId") || undefined,
    examSeriesId: searchParams.get("examSeriesId") || undefined,
    year: year ? Number(year) : undefined,
    month: month ? Number(month) : undefined,
    grade: searchParams.get("grade") || undefined,
    className: searchParams.get("className") || undefined,
    subjectId: searchParams.get("subjectId") || undefined,
    status: searchParams.get("status") || undefined,
    studentName: searchParams.get("studentName") || undefined,
    studentNo: searchParams.get("studentNo") || undefined,
    registrationSource: searchParams.get("registrationSource") || undefined,
    visibility: searchParams.get("visibility") || undefined,
    billingScope: searchParams.get("billingScope") || undefined,
    registrationType: searchParams.get("registrationType") || undefined,
    registrationTypes:
      searchParams
        .get("registrationTypes")
        ?.split(",")
        .map((part) => part.trim())
        .filter(Boolean) || undefined,
    studentType: searchParams.get("studentType") || undefined,
    candidateType: searchParams.get("candidateType") || undefined,
    assessmentHubCandidateNumber:
      searchParams.get("assessmentHubCandidateNumber") || undefined,
  };
}
