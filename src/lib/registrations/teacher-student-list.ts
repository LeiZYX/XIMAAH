import type { Prisma } from "@/generated/prisma/client";
import type { RegistrationChangeRequestStatus } from "@/generated/prisma/enums";
import { buildPaginationMeta } from "@/lib/pagination";
import {
  buildTeacherRegistrationWhere,
  type RegistrationListFilters,
} from "@/lib/registrations/filters";
import { registrationInclude } from "@/lib/registrations/include";
import {
  groupRegistrationsByWindow,
  type StudentRegistrationRow,
} from "@/lib/registrations/student-groups";
import { entryTypeLabel } from "@/lib/registrations/stage-labels";
import { prisma } from "@/lib/prisma";

const teacherRegistrationStatusFilter: Prisma.StudentExamRegistrationWhereInput = {
  status: { in: ["ACTIVE", "LOCKED"] },
};

const teacherRegistrationDetailInclude = {
  examSession: registrationInclude.examSession,
  registrationWindow: registrationInclude.registrationWindow,
  examBoard: registrationInclude.examBoard,
  examSeries: registrationInclude.examSeries,
  subject: registrationInclude.subject,
  paper: registrationInclude.paper,
  student: registrationInclude.student,
  registrationWorkspace: {
    include: {
      lastAdjustedByUser: { select: { name: true } },
    },
  },
} satisfies Prisma.StudentExamRegistrationInclude;

type DetailRegistration = Prisma.StudentExamRegistrationGetPayload<{
  include: typeof teacherRegistrationDetailInclude;
}>;

const summarySelect = {
  id: true,
  studentId: true,
  studentNoSnapshot: true,
  studentNameSnapshot: true,
  gradeSnapshot: true,
  classNameSnapshot: true,
  assessmentHubCandidateNumberSnapshot: true,
  candidateTypeSnapshot: true,
  status: true,
  updatedAt: true,
  examBoard: { select: { id: true, name: true, code: true } },
  examSeries: { select: { id: true, name: true, year: true } },
} satisfies Prisma.StudentExamRegistrationSelect;

type SummaryRegistration = Prisma.StudentExamRegistrationGetPayload<{
  select: typeof summarySelect;
}>;

export type TeacherStudentRegistrationStatus = "ACTIVE" | "LOCKED" | "MIXED";

export interface TeacherStudentSummary {
  studentKey: string;
  studentId: string | null;
  studentName: string;
  studentNo: string;
  candidateNumber: string;
  grade: string;
  className: string;
  examBoards: string;
  examSeries: string;
  totalExams: number;
  pendingChangeRequests: number;
  registrationStatus: TeacherStudentRegistrationStatus;
  hasLockedExams: boolean;
  canPrint: boolean;
}

export interface TeacherStudentExamRow {
  id: string;
  status: string;
  entryType: string;
  entryTypeLabel: string;
  registrationWorkspaceId: string | null;
  studentNameSnapshot: string;
  studentNoSnapshot: string;
  gradeSnapshot: string;
  classNameSnapshot: string;
  examBoard: { id: string; name: string; code: string };
  examSeries: { id: string; name: string; year: number };
  subject: { id: string; name: string; code: string };
  paper: { code: string; title: string };
  examSession: { id: string; date: string; startTime: string | null };
  registrationWindow: {
    id: string;
    title: string;
    status: string;
  };
}

export interface TeacherStudentDetail {
  summary: TeacherStudentSummary;
  candidate: {
    candidateNumber: string;
    candidateType: string;
    studentNo: string;
    email: string | null;
  };
  registrationSummary: {
    totalExams: number;
    activeExams: number;
    lockedExams: number;
    windows: Array<{
      id: string;
      title: string;
      examSeries: string;
      status: string;
      examCount: number;
    }>;
  };
  windowGroups: ReturnType<typeof groupRegistrationsByWindow>;
  exams: TeacherStudentExamRow[];
}

export function buildTeacherStudentKey(input: {
  studentId: string | null;
  studentNoSnapshot: string;
}): string {
  if (input.studentId) return `user:${input.studentId}`;
  return `no:${input.studentNoSnapshot}`;
}

export function parseTeacherStudentKey(studentKey: string): Prisma.StudentExamRegistrationWhereInput {
  if (studentKey.startsWith("user:")) {
    const studentId = studentKey.slice(5);
    if (!studentId) throw new Error("Invalid student key");
    return { studentId };
  }

  if (studentKey.startsWith("no:")) {
    const studentNo = studentKey.slice(3);
    if (!studentNo) throw new Error("Invalid student key");
    return { studentNoSnapshot: studentNo };
  }

  throw new Error("Invalid student key");
}

function summarizeExamSeries(rows: SummaryRegistration[]): string {
  const unique = new Map<string, SummaryRegistration["examSeries"]>();
  for (const row of rows) {
    unique.set(row.examSeries.id, row.examSeries);
  }
  const series = [...unique.values()];
  if (series.length === 0) return "—";
  if (series.length === 1) return `${series[0].name} (${series[0].year})`;
  return series.map((item) => `${item.name} (${item.year})`).join(", ");
}

function aggregateRegistrationStatus(
  rows: Array<{ status: string }>,
): TeacherStudentRegistrationStatus {
  const hasActive = rows.some((row) => row.status === "ACTIVE");
  const hasLocked = rows.some((row) => row.status === "LOCKED");
  if (hasActive && hasLocked) return "MIXED";
  if (hasActive) return "ACTIVE";
  return "LOCKED";
}

function buildPendingRequestCounts(
  requests: Array<{
    status: RegistrationChangeRequestStatus;
    registrationWorkspace: {
      student: {
        id: string;
        studentProfile: { studentNo: string } | null;
      } | null;
    } | null;
  }>,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const request of requests) {
    if (request.status !== "PENDING") continue;
    const student = request.registrationWorkspace?.student;
    if (!student) continue;
    const key = buildTeacherStudentKey({
      studentId: student.id,
      studentNoSnapshot: student.studentProfile?.studentNo ?? "",
    });
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function summarizeBoardNames(rows: Array<{ examBoard: { name: string } }>): string {
  const boards = [...new Set(rows.map((row) => row.examBoard.name))];
  if (boards.length === 0) return "—";
  if (boards.length === 1) return boards[0];
  return "Mixed exam boards";
}

function groupSummaryRows(
  rows: SummaryRegistration[],
  pendingCounts: Map<string, number>,
): TeacherStudentSummary[] {
  const groups = new Map<string, SummaryRegistration[]>();

  for (const row of rows) {
    const key = buildTeacherStudentKey(row);
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  const summaries = [...groups.entries()].map(([studentKey, registrations]) => {
    const first = registrations[0];
    const registrationStatus = aggregateRegistrationStatus(registrations);
    const hasLockedExams = registrations.some((row) => row.status === "LOCKED");

    return {
      studentKey,
      studentId: first.studentId,
      studentName: first.studentNameSnapshot,
      studentNo: first.studentNoSnapshot,
      candidateNumber: first.assessmentHubCandidateNumberSnapshot ?? "—",
      grade: first.gradeSnapshot,
      className: first.classNameSnapshot,
      examBoards: summarizeBoardNames(registrations),
      examSeries: summarizeExamSeries(registrations),
      totalExams: registrations.length,
      pendingChangeRequests: pendingCounts.get(studentKey) ?? 0,
      registrationStatus,
      hasLockedExams,
      canPrint: hasLockedExams,
    };
  });

  return summaries.sort((a, b) => {
    const nameCompare = a.studentName.localeCompare(b.studentName);
    if (nameCompare !== 0) return nameCompare;
    return a.studentNo.localeCompare(b.studentNo);
  });
}

function mapRegistrationToStudentRow(reg: DetailRegistration): StudentRegistrationRow {
  return {
    id: reg.id,
    status: reg.status,
    updatedAt: reg.updatedAt.toISOString(),
    lockedAt: reg.lockedAt?.toISOString() ?? null,
    studentNameSnapshot: reg.studentNameSnapshot,
    studentNoSnapshot: reg.studentNoSnapshot,
    gradeSnapshot: reg.gradeSnapshot,
    classNameSnapshot: reg.classNameSnapshot,
    emailSnapshot: reg.emailSnapshot,
    assessmentHubCandidateNumberSnapshot: reg.assessmentHubCandidateNumberSnapshot,
    candidateTypeSnapshot: reg.candidateTypeSnapshot,
    registrationSource: reg.registrationSource,
    examBoard: reg.examBoard,
    examSeries: reg.examSeries,
    subject: reg.subject,
    paper: reg.paper,
    examSession: {
      date: reg.examSession.date.toISOString(),
      startTime: reg.examSession.startTime,
      endTime: reg.examSession.endTime,
      venue: reg.examSession.venue,
    },
    registrationWindow: {
      id: reg.registrationWindow.id,
      title: reg.registrationWindow.title,
      status: reg.registrationWindow.status,
      studentRegistrationOpenAt: reg.registrationWindow.studentRegistrationOpenAt.toISOString(),
      studentRegistrationCloseAt: reg.registrationWindow.studentRegistrationCloseAt.toISOString(),
      registrationCloseAt: reg.registrationWindow.registrationCloseAt.toISOString(),
    },
    registrationWorkspace: reg.registrationWorkspace
      ? {
          id: reg.registrationWorkspace.id,
          hasPostLockAdjustment: reg.registrationWorkspace.hasPostLockAdjustment,
          isLateRegistration: reg.registrationWorkspace.isLateRegistration,
          registrationSource: reg.registrationWorkspace.registrationSource ?? undefined,
          lastAdjustedAt: reg.registrationWorkspace.lastAdjustedAt?.toISOString() ?? null,
          lastAdjustmentReason: reg.registrationWorkspace.lastAdjustmentReason,
          lastAdjustmentSummary: reg.registrationWorkspace.lastAdjustmentSummary,
          lastAdjustedByRole: reg.registrationWorkspace.lastAdjustedByRole,
          lastAdjustedByUser: reg.registrationWorkspace.lastAdjustedByUser
            ? { name: reg.registrationWorkspace.lastAdjustedByUser.name }
            : null,
        }
      : null,
  };
}

function mapRegistrationToExamRow(reg: DetailRegistration): TeacherStudentExamRow {
  return {
    id: reg.id,
    status: reg.status,
    entryType: reg.entryType,
    entryTypeLabel: entryTypeLabel(reg.entryType),
    registrationWorkspaceId: reg.registrationWorkspaceId,
    studentNameSnapshot: reg.studentNameSnapshot,
    studentNoSnapshot: reg.studentNoSnapshot,
    gradeSnapshot: reg.gradeSnapshot,
    classNameSnapshot: reg.classNameSnapshot,
    examBoard: reg.examBoard,
    examSeries: reg.examSeries,
    subject: reg.subject,
    paper: reg.paper,
    examSession: {
      id: reg.examSession.id,
      date: reg.examSession.date.toISOString(),
      startTime: reg.examSession.startTime,
    },
    registrationWindow: {
      id: reg.registrationWindow.id,
      title: reg.registrationWindow.title,
      status: reg.registrationWindow.status,
    },
  };
}

async function loadTeacherPendingRequests(teacherId: string) {
  return prisma.registrationChangeRequest.findMany({
    where: { requestedByUserId: teacherId, status: "PENDING" },
    select: {
      status: true,
      registrationWorkspace: {
        select: {
          student: {
            select: {
              id: true,
              studentProfile: { select: { studentNo: true } },
            },
          },
        },
      },
    },
  });
}

function buildTeacherFilteredWhere(
  filters: RegistrationListFilters,
): Prisma.StudentExamRegistrationWhereInput {
  return {
    AND: [buildTeacherRegistrationWhere(filters), teacherRegistrationStatusFilter],
  };
}

export async function listTeacherStudentSummaries(
  filters: RegistrationListFilters,
  page: number,
  pageSize: number,
  teacherId: string,
) {
  const where = buildTeacherFilteredWhere(filters);

  const [rows, pendingRequests] = await Promise.all([
    prisma.studentExamRegistration.findMany({
      where,
      select: summarySelect,
      orderBy: [{ studentNameSnapshot: "asc" }, { studentNoSnapshot: "asc" }],
    }),
    loadTeacherPendingRequests(teacherId),
  ]);

  const pendingCounts = buildPendingRequestCounts(pendingRequests);
  const summaries = groupSummaryRows(rows, pendingCounts);
  const total = summaries.length;
  const { skip, page: safePage, totalPages, pageSize: size } = buildPaginationMeta(
    total,
    page,
    pageSize,
  );

  return {
    students: summaries.slice(skip, skip + size),
    total,
    page: safePage,
    pageSize: size,
    totalPages,
  };
}

export async function getTeacherStudentDetail(
  studentKey: string,
  filters: RegistrationListFilters,
  teacherId: string,
) {
  const studentWhere = parseTeacherStudentKey(studentKey);
  const where = {
    AND: [buildTeacherFilteredWhere(filters), studentWhere],
  };

  const [registrations, pendingRequests] = await Promise.all([
    prisma.studentExamRegistration.findMany({
      where,
      include: teacherRegistrationDetailInclude,
      orderBy: [
        { examSession: { date: "asc" } },
        { subject: { name: "asc" } },
        { paper: { code: "asc" } },
      ],
    }),
    loadTeacherPendingRequests(teacherId),
  ]);

  if (registrations.length === 0) {
    return null;
  }

  const summaryRows: SummaryRegistration[] = registrations.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    studentNoSnapshot: row.studentNoSnapshot,
    studentNameSnapshot: row.studentNameSnapshot,
    gradeSnapshot: row.gradeSnapshot,
    classNameSnapshot: row.classNameSnapshot,
    assessmentHubCandidateNumberSnapshot: row.assessmentHubCandidateNumberSnapshot,
    candidateTypeSnapshot: row.candidateTypeSnapshot,
    status: row.status,
    updatedAt: row.updatedAt,
    examBoard: row.examBoard,
    examSeries: row.examSeries,
  }));

  const pendingCounts = buildPendingRequestCounts(pendingRequests);
  const summary = groupSummaryRows(summaryRows, pendingCounts)[0];
  if (!summary) return null;

  const studentRows = registrations.map(mapRegistrationToStudentRow);
  const windowGroups = groupRegistrationsByWindow(studentRows);
  const first = registrations[0];

  const windows = windowGroups.map((group) => ({
    id: group.windowId,
    title: group.window.title,
    examSeries: `${group.examSeries.name} (${group.examSeries.year})`,
    status: group.cardStatus,
    examCount: group.registrations.length,
  }));

  return {
    summary,
    candidate: {
      candidateNumber: first.assessmentHubCandidateNumberSnapshot ?? "—",
      candidateType: first.candidateTypeSnapshot ?? "INTERNAL",
      studentNo: first.studentNoSnapshot,
      email: first.emailSnapshot,
    },
    registrationSummary: {
      totalExams: registrations.length,
      activeExams: registrations.filter((row) => row.status === "ACTIVE").length,
      lockedExams: registrations.filter((row) => row.status === "LOCKED").length,
      windows,
    },
    windowGroups,
    exams: registrations.map(mapRegistrationToExamRow),
  } satisfies TeacherStudentDetail;
}
