import type { CandidateStatus, CandidateType, Prisma } from "@/generated/prisma/client";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { ensureInternalCandidatesSynced } from "@/lib/candidates/service";
import { buildPaginationMeta } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export interface CandidateListFilters {
  candidateType?: CandidateType;
  status?: CandidateStatus;
  grade?: string;
  className?: string;
  q?: string;
  assessmentHubCandidateNumber?: string;
  studentNumber?: string;
  email?: string;
  phone?: string;
}

export function parseCandidateListFilters(searchParams: URLSearchParams): CandidateListFilters {
  const type = searchParams.get("candidateType")?.toUpperCase();
  const status = searchParams.get("status")?.toUpperCase();
  return {
    candidateType: type === "INTERNAL" || type === "EXTERNAL" ? type : undefined,
    status:
      status === "ACTIVE" ||
      status === "GRADUATED" ||
      status === "LEFT" ||
      status === "INACTIVE"
        ? status
        : undefined,
    grade: searchParams.get("grade")?.trim() || undefined,
    className: searchParams.get("className")?.trim() || undefined,
    q: searchParams.get("q")?.trim() || undefined,
    assessmentHubCandidateNumber:
      searchParams.get("assessmentHubCandidateNumber")?.trim() || undefined,
    studentNumber: searchParams.get("studentNumber")?.trim() || undefined,
    email: searchParams.get("email")?.trim() || undefined,
    phone: searchParams.get("phone")?.trim() || undefined,
  };
}

export function buildCandidateWhere(filters: CandidateListFilters): Prisma.CandidateWhereInput {
  const where: Prisma.CandidateWhereInput = {};
  if (filters.candidateType) where.candidateType = filters.candidateType;
  if (filters.status) where.status = filters.status;
  if (filters.grade) where.grade = filters.grade;
  if (filters.className) where.className = filters.className;
  if (filters.assessmentHubCandidateNumber) {
    where.assessmentHubCandidateNumber = {
      contains: filters.assessmentHubCandidateNumber,
      mode: "insensitive",
    };
  }
  if (filters.studentNumber) {
    where.studentNumber = { contains: filters.studentNumber, mode: "insensitive" };
  }
  if (filters.email) where.email = { contains: filters.email, mode: "insensitive" };
  if (filters.phone) where.phone = { contains: filters.phone, mode: "insensitive" };
  if (filters.q) {
    where.OR = [
      { englishName: { contains: filters.q, mode: "insensitive" } },
      { chineseName: { contains: filters.q, mode: "insensitive" } },
      { assessmentHubCandidateNumber: { contains: filters.q, mode: "insensitive" } },
      { studentNumber: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listCandidates(
  filters: CandidateListFilters,
  page = 1,
  pageSize = 50,
) {
  await ensureInternalCandidatesSynced();
  const where = buildCandidateWhere(filters);
  const total = await prisma.candidate.count({ where });
  const { skip, page: safePage, totalPages } = buildPaginationMeta(total, page, pageSize);

  const candidates = await prisma.candidate.findMany({
    where,
    orderBy: [{ englishName: "asc" }],
    skip,
    take: pageSize,
    include: {
      examIdentities: {
        include: { examBoard: { select: { id: true, name: true, code: true } } },
      },
    },
  });

  return {
    candidates,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export const candidateDetailInclude = {
  examIdentities: {
    include: { examBoard: { select: { id: true, name: true, code: true } } },
    orderBy: { examBoard: { name: "asc" as const } },
  },
  user: { select: { id: true, email: true, role: true, isActive: true } },
  registrationWorkspaces: {
    include: {
      registrationWindow: {
        include: { examBoard: true, examSeries: true },
      },
      registrations: {
        where: { status: { in: [RegistrationStatus.ACTIVE, RegistrationStatus.LOCKED] } },
        take: 5,
      },
    },
    orderBy: { updatedAt: "desc" as const },
    take: 10,
  },
  feeStatements: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
    select: {
      id: true,
      statementNo: true,
      status: true,
      totalGbpAmount: true,
      totalCnyAmount: true,
      createdAt: true,
    },
  },
};

export async function getCandidateById(id: string) {
  return prisma.candidate.findUnique({
    where: { id },
    include: candidateDetailInclude,
  });
}
