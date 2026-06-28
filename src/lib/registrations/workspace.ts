import { RegistrationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { buildPostLockAdjustmentHistoryFromAuditLogs } from "@/lib/registrations/adjustment-history";
import { registrationInclude } from "@/lib/registrations/include";
import type { AdjustmentSummaryPayload } from "@/lib/registrations/workspace-display";

export type { AdjustmentSummaryPayload } from "@/lib/registrations/workspace-display";
export { parseAdjustmentSummary, formatAdjusterLabel } from "@/lib/registrations/workspace-display";

export const workspaceInclude = {
  candidate: {
    include: {
      examIdentities: {
        include: { examBoard: { select: { id: true, name: true, code: true } } },
      },
    },
  },
  student: { include: { studentProfile: true } },
  registrationWindow: { include: { examBoard: true, examSeries: true } },
  lastAdjustedByUser: { select: { id: true, name: true, role: true } },
  registrations: {
    where: { status: { in: [RegistrationStatus.ACTIVE, RegistrationStatus.LOCKED] } },
    include: registrationInclude,
    orderBy: [{ examSession: { date: "asc" as const } }, { paper: { code: "asc" as const } }],
  },
  auditLogs: {
    include: {
      performedBy: { select: { id: true, name: true, role: true } },
      examSession: {
        include: {
          paper: { include: { subject: true } },
        },
      },
    },
    orderBy: { performedAt: "asc" as const },
  },
  changeRequests: {
    include: {
      requestedBy: { select: { id: true, name: true, role: true } },
      reviewedBy: { select: { id: true, name: true, role: true } },
      targetExamSession: {
        include: { paper: { include: { subject: true } } },
      },
      replacementExamSession: {
        include: { paper: { include: { subject: true } } },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
};

export async function ensureRegistrationWorkspaceForCandidate(
  candidateId: string,
  registrationWindowId: string,
  studentId?: string | null,
) {
  const byCandidate = await prisma.registrationWorkspace.findFirst({
    where: { candidateId, registrationWindowId },
  });
  if (byCandidate) return byCandidate;

  if (studentId) {
    return prisma.registrationWorkspace.upsert({
      where: {
        studentId_registrationWindowId: { studentId, registrationWindowId },
      },
      create: { candidateId, studentId, registrationWindowId },
      update: { candidateId },
    });
  }

  return prisma.registrationWorkspace.create({
    data: { candidateId, registrationWindowId },
  });
}

export async function ensureRegistrationWorkspace(
  studentId: string,
  registrationWindowId: string,
) {
  const { syncCandidateFromStudentUser } = await import("@/lib/candidates/service");
  const candidate = await syncCandidateFromStudentUser(studentId);
  if (!candidate) {
    throw new Error("Could not resolve candidate for student");
  }
  return ensureRegistrationWorkspaceForCandidate(candidate.id, registrationWindowId, studentId);
}

export async function backfillRegistrationWorkspaces() {
  const rows = await prisma.studentExamRegistration.findMany({
    where: { registrationWorkspaceId: null },
    select: { id: true, studentId: true, registrationWindowId: true },
    distinct: ["studentId", "registrationWindowId"],
  });

  for (const row of rows) {
    if (!row.studentId) continue;
    const workspace = await ensureRegistrationWorkspace(row.studentId, row.registrationWindowId);
    await prisma.studentExamRegistration.updateMany({
      where: {
        studentId: row.studentId,
        registrationWindowId: row.registrationWindowId,
        registrationWorkspaceId: null,
      },
      data: { registrationWorkspaceId: workspace.id },
    });
  }
}

export async function getRegistrationWorkspaceById(workspaceId: string) {
  await backfillRegistrationWorkspaces();

  return prisma.registrationWorkspace.findUnique({
    where: { id: workspaceId },
    include: workspaceInclude,
  });
}

export async function findWorkspaceForStudentWindow(
  studentId: string,
  registrationWindowId: string,
) {
  await backfillRegistrationWorkspaces();

  return prisma.registrationWorkspace.findUnique({
    where: {
      studentId_registrationWindowId: { studentId, registrationWindowId },
    },
    include: workspaceInclude,
  });
}

const POST_LOCK_ADJUSTMENT_ACTIONS = [
  "EO_ADD_AFTER_LOCK",
  "EO_REMOVE_AFTER_LOCK",
  "EO_REPLACE_AFTER_LOCK",
  "ADMIN_ADD_AFTER_LOCK",
  "ADMIN_REMOVE_AFTER_LOCK",
  "ADMIN_REPLACE_AFTER_LOCK",
] as const;

export async function loadPostLockAdjustmentHistoryForWorkspaces(workspaceIds: string[]) {
  const uniqueIds = [...new Set(workspaceIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, ReturnType<typeof buildPostLockAdjustmentHistoryFromAuditLogs>>();

  const logs = await prisma.registrationAuditLog.findMany({
    where: {
      registrationWorkspaceId: { in: uniqueIds },
      action: { in: [...POST_LOCK_ADJUSTMENT_ACTIONS] },
    },
    include: {
      performedBy: { select: { name: true, role: true } },
      examSession: { include: { paper: { include: { subject: true } } } },
    },
    orderBy: { performedAt: "asc" },
  });

  const grouped = new Map<string, typeof logs>();
  for (const log of logs) {
    if (!log.registrationWorkspaceId) continue;
    const current = grouped.get(log.registrationWorkspaceId) ?? [];
    current.push(log);
    grouped.set(log.registrationWorkspaceId, current);
  }

  const result = new Map<string, ReturnType<typeof buildPostLockAdjustmentHistoryFromAuditLogs>>();
  for (const workspaceId of uniqueIds) {
    const workspaceLogs = grouped.get(workspaceId) ?? [];
    result.set(
      workspaceId,
      buildPostLockAdjustmentHistoryFromAuditLogs(
        workspaceLogs.map((log) => ({
          action: log.action,
          performedAt: log.performedAt.toISOString(),
          reason: log.reason,
          note: log.note,
          performedByRole: log.performedByRole,
          performedBy: log.performedBy,
          examSession: log.examSession,
        })),
      ),
    );
  }

  return result;
}
