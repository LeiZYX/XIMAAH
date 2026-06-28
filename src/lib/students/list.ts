import type { Prisma } from "@/generated/prisma/client";
import {
  buildStudentProfileWhere,
  parseStudentStatusFilter,
  type StudentStatusFilter,
} from "@/lib/students/archive";
import { buildPaginationMeta } from "@/lib/pagination";
import { containsFilter } from "@/lib/db/string-filters";
import { prisma } from "@/lib/prisma";

export interface StudentListFilters {
  status?: StudentStatusFilter;
  q?: string;
  grade?: string;
  className?: string;
}

export function parseStudentListFilters(searchParams: URLSearchParams): StudentListFilters {
  return {
    status: parseStudentStatusFilter(searchParams.get("status")),
    q: searchParams.get("q")?.trim() || undefined,
    grade: searchParams.get("grade")?.trim() || undefined,
    className: searchParams.get("className")?.trim() || undefined,
  };
}

export async function listStudents(filters: StudentListFilters, page = 1, pageSize = 50) {
  const status = filters.status ?? "ACTIVE";
  const profileWhere = buildStudentProfileWhere(status);

  const where: Prisma.UserWhereInput = {
    role: "STUDENT",
    studentProfile: {
      is: {
        ...profileWhere,
        ...(filters.grade ? { currentGrade: filters.grade } : {}),
        ...(filters.className ? { currentClassName: filters.className } : {}),
      },
    },
  };

  if (filters.q) {
    where.OR = [
      { name: containsFilter(filters.q) },
      { email: containsFilter(filters.q) },
      { studentNo: containsFilter(filters.q) },
      { studentProfile: { is: { studentNo: containsFilter(filters.q) } } },
    ];
  }

  const total = await prisma.user.count({ where });
  const { skip, page: safePage, totalPages } = buildPaginationMeta(total, page, pageSize);

  const rows = await prisma.user.findMany({
    where,
    include: { studentProfile: true },
    orderBy: [{ name: "asc" }],
    skip,
    take: pageSize,
  });

  const students = rows.map((student) => ({
    id: student.id,
    name: student.name,
    email: student.email ?? student.studentProfile?.email ?? null,
    isActive: student.isActive,
    studentNo: student.studentProfile?.studentNo ?? null,
    grade: student.studentProfile?.currentGrade ?? null,
    className: student.studentProfile?.currentClassName ?? null,
    status: student.studentProfile?.status ?? "ACTIVE",
    entryYear: student.studentProfile?.entryYear ?? null,
    graduationYear: student.studentProfile?.graduationYear ?? null,
    graduatedAt: student.studentProfile?.graduatedAt?.toISOString() ?? null,
    leftAt: student.studentProfile?.leftAt?.toISOString() ?? null,
    archivedAt: student.studentProfile?.archivedAt?.toISOString() ?? null,
  }));

  return {
    students,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}
