import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface RegistrationListFilters {
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
}

export function buildRegistrationWhere(
  filters: RegistrationListFilters,
): Prisma.StudentExamRegistrationWhereInput {
  const where: Prisma.StudentExamRegistrationWhereInput = {};

  if (filters.examBoardId) where.examBoardId = filters.examBoardId;
  if (filters.examSeriesId) where.examSeriesId = filters.examSeriesId;
  if (filters.grade) where.gradeSnapshot = filters.grade;
  if (filters.className) where.classNameSnapshot = filters.className;
  if (filters.subjectId) where.subjectId = filters.subjectId;
  if (filters.status) where.status = filters.status as Prisma.EnumRegistrationStatusFilter;
  if (filters.studentNo) {
    where.studentNoSnapshot = { contains: filters.studentNo, mode: "insensitive" };
  }
  if (filters.studentName) {
    where.studentNameSnapshot = { contains: filters.studentName, mode: "insensitive" };
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

export async function buildTeacherRegistrationWhere(
  teacherId: string,
  filters: RegistrationListFilters,
): Promise<Prisma.StudentExamRegistrationWhereInput> {
  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacherId },
    include: { subject: { select: { name: true } } },
  });
  const base = buildRegistrationWhere(filters);
  const subjectNames = [...new Set(assignments.map((assignment) => assignment.subject.name))];

  if (subjectNames.length === 0) {
    return { id: "__no_access__" };
  }

  const subjectFilter: Prisma.StudentExamRegistrationWhereInput = {
    OR: subjectNames.map((name) => ({
      subject: { name: { equals: name, mode: "insensitive" } },
    })),
  };

  if (Object.keys(base).length === 0) {
    return subjectFilter;
  }

  return {
    AND: [base, subjectFilter],
  };
}

export function parseRegistrationFilters(searchParams: URLSearchParams): RegistrationListFilters {
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  return {
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
  };
}
