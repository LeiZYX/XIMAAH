import type { Prisma } from "@/generated/prisma/client";
import type { CandidateType, RegistrationType } from "@/generated/prisma/enums";
import { containsFilter } from "@/lib/db/string-filters";
import { registrationInclude } from "@/lib/registrations/include";
import { isRestrictedRegistrationType } from "@/lib/registrations/registration-type";
import { prisma } from "@/lib/prisma";

export interface ExamDocumentFilters {
  registrationWindowId?: string;
  examSessionId?: string;
  examBoardId?: string;
  examSeriesId?: string;
  subjectId?: string;
  grade?: string;
  className?: string;
  candidateType?: CandidateType;
  registrationType?: RegistrationType | "ALL";
  room?: string;
  date?: string;
  candidateSearch?: string;
}

export const IMPLEMENTED_DOCUMENT_TYPES = [
  "STATEMENT_OF_ENTRY",
  "CANDIDATE_TIMETABLE",
  "ATTENDANCE_REGISTER",
  "SEATING_PLAN",
  "CANDIDATE_LIST",
  "CANDIDATE_LABELS",
  "NORMAL_FEE_STATEMENT",
  "RESTRICTED_INVOICE",
] as const;

export type ImplementedDocumentType = (typeof IMPLEMENTED_DOCUMENT_TYPES)[number];

export function parseExamDocumentFilters(searchParams: URLSearchParams): ExamDocumentFilters {
  const candidateType = searchParams.get("candidateType");
  const registrationType = searchParams.get("registrationType");
  return {
    registrationWindowId: searchParams.get("registrationWindowId")?.trim() || undefined,
    examSessionId: searchParams.get("examSessionId")?.trim() || undefined,
    examBoardId: searchParams.get("examBoardId")?.trim() || undefined,
    examSeriesId: searchParams.get("examSeriesId")?.trim() || undefined,
    subjectId: searchParams.get("subjectId")?.trim() || undefined,
    grade: searchParams.get("grade")?.trim() || undefined,
    className: searchParams.get("className")?.trim() || undefined,
    candidateType:
      candidateType === "INTERNAL" || candidateType === "EXTERNAL" ? candidateType : undefined,
    registrationType:
      registrationType === "NORMAL" ||
      registrationType === "RESTRICTED" ||
      registrationType === "EXTERNAL" ||
      registrationType === "ALL"
        ? registrationType
        : undefined,
    room: searchParams.get("room")?.trim() || undefined,
    date: searchParams.get("date")?.trim() || undefined,
    candidateSearch: searchParams.get("candidateSearch")?.trim() || undefined,
  };
}

function buildBaseWhere(
  filters: ExamDocumentFilters,
  options: { restrictedOnly?: boolean; normalDocuments?: boolean },
): Prisma.StudentExamRegistrationWhereInput {
  const where: Prisma.StudentExamRegistrationWhereInput = {
    status: { in: ["ACTIVE", "LOCKED"] },
  };

  if (options.restrictedOnly) {
    where.registrationType = "RESTRICTED";
  } else if (options.normalDocuments !== false) {
    where.registrationType = { not: "RESTRICTED" };
  }

  if (filters.registrationType && filters.registrationType !== "ALL" && !options.restrictedOnly) {
    where.registrationType = filters.registrationType;
  }

  if (filters.registrationWindowId) where.registrationWindowId = filters.registrationWindowId;
  if (filters.examBoardId) where.examBoardId = filters.examBoardId;
  if (filters.examSeriesId) where.examSeriesId = filters.examSeriesId;
  if (filters.subjectId) where.subjectId = filters.subjectId;
  if (filters.grade) where.gradeSnapshot = filters.grade;
  if (filters.className) where.classNameSnapshot = filters.className;
  if (filters.examSessionId) where.examSessionId = filters.examSessionId;
  if (filters.candidateType) where.candidateTypeSnapshot = filters.candidateType;

  if (filters.candidateSearch) {
    where.OR = [
      { studentNameSnapshot: containsFilter(filters.candidateSearch) },
      { studentNoSnapshot: containsFilter(filters.candidateSearch) },
      { assessmentHubCandidateNumberSnapshot: containsFilter(filters.candidateSearch) },
    ];
  }

  if (filters.room || filters.date) {
    where.examSession = {
      ...(filters.room ? { venue: containsFilter(filters.room) } : {}),
      ...(filters.date
        ? {
            date: {
              gte: new Date(`${filters.date}T00:00:00.000Z`),
              lt: new Date(new Date(`${filters.date}T00:00:00.000Z`).getTime() + 86_400_000),
            },
          }
        : {}),
    };
  }

  return where;
}

export async function queryExamDocumentRegistrations(
  filters: ExamDocumentFilters,
  options: { restrictedOnly?: boolean } = {},
) {
  return prisma.studentExamRegistration.findMany({
    where: buildBaseWhere(filters, {
      restrictedOnly: options.restrictedOnly,
      normalDocuments: !options.restrictedOnly,
    }),
    include: {
      ...registrationInclude,
      candidate: {
        include: {
          examIdentities: {
            include: { examBoard: { select: { id: true, name: true, code: true } } },
          },
        },
      },
      registrationWorkspace: {
        select: {
          id: true,
          registrationType: true,
          restrictedReason: true,
          restrictedCreatedAt: true,
        },
      },
    },
    orderBy: [
      { studentNameSnapshot: "asc" },
      { examSession: { date: "asc" } },
      { examSession: { startTime: "asc" } },
    ],
  });
}

export function groupRegistrationsByCandidate<
  T extends {
    candidateId: string | null;
    studentId: string | null;
    studentNameSnapshot: string;
    studentNoSnapshot: string;
    gradeSnapshot: string;
    classNameSnapshot: string;
    assessmentHubCandidateNumberSnapshot: string | null;
    registrationType: string;
  },
>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.candidateId ?? row.studentId ?? row.studentNoSnapshot;
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  }
  return [...map.entries()].map(([key, registrations]) => ({
    key,
    registrations,
    registrationType: registrations[0]?.registrationType ?? "NORMAL",
    isRestricted: isRestrictedRegistrationType(registrations[0]?.registrationType),
  }));
}

export function groupRegistrationsBySession<
  T extends {
    examSessionId: string;
    examSession: {
      id: string;
      date: Date;
      startTime: string | null;
      endTime: string | null;
      venue: string | null;
      paper: { code: string; title: string; subject: { name: string } };
    };
  },
>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = map.get(row.examSessionId) ?? [];
    bucket.push(row);
    map.set(row.examSessionId, bucket);
  }
  return [...map.entries()].map(([examSessionId, registrations]) => ({
    examSessionId,
    session: registrations[0]!.examSession,
    registrations,
  }));
}
