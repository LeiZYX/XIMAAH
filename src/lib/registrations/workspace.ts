import type { Prisma } from "@/generated/prisma/client";
import type { RegistrationType } from "@/generated/prisma/enums";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { buildPostLockAdjustmentHistoryFromAuditLogs } from "@/lib/registrations/adjustment-history";
import { registrationInclude } from "@/lib/registrations/include";
import { flagsForRegistrationType } from "@/lib/registrations/metadata";
import { billingScopeForRegistrationType, generateConfirmationNumber, generateRegistrationNumber } from "@/lib/registrations/numbering";
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

function workspaceDefaultsForType(registrationType: RegistrationType) {
  const visibilityFlags = flagsForRegistrationType(registrationType);
  return {
    registrationType,
    ...visibilityFlags,
    visibility:
      registrationType === "INTERNAL_NORMAL"
        ? ("STUDENT_AND_TEACHER" as const)
        : ("EXAM_OFFICE_ONLY" as const),
    billingScope: billingScopeForRegistrationType(registrationType),
  };
}

type WorkspaceClient = Prisma.TransactionClient | typeof prisma;

export async function ensureWorkspaceConfirmationNumber(
  workspace: {
    id: string;
    confirmationNumber: string | null;
    lockedAt: Date | null;
    registrationType: RegistrationType;
  },
  client: WorkspaceClient = prisma,
): Promise<string | null> {
  if (workspace.confirmationNumber) return workspace.confirmationNumber;
  if (!workspace.lockedAt) return null;

  const confirmationNumber = await generateConfirmationNumber(
    workspace.registrationType,
    workspace.lockedAt.getFullYear(),
    client,
  );
  await client.registrationWorkspace.update({
    where: { id: workspace.id },
    data: { confirmationNumber },
  });
  return confirmationNumber;
}

async function findRegistrationWorkspace(
  client: WorkspaceClient,
  params: {
    candidateId: string;
    registrationWindowId: string;
    registrationType: RegistrationType;
    studentId?: string | null;
  },
) {
  const byCandidate = await client.registrationWorkspace.findFirst({
    where: {
      candidateId: params.candidateId,
      registrationWindowId: params.registrationWindowId,
      registrationType: params.registrationType,
    },
  });
  if (byCandidate) return byCandidate;

  if (params.studentId) {
    return client.registrationWorkspace.findFirst({
      where: {
        studentId: params.studentId,
        registrationWindowId: params.registrationWindowId,
        registrationType: params.registrationType,
      },
    });
  }

  return null;
}

export async function ensureRegistrationWorkspaceForCandidate(
  candidateId: string,
  registrationWindowId: string,
  studentId?: string | null,
  registrationType: RegistrationType = "INTERNAL_NORMAL",
  client: WorkspaceClient = prisma,
) {
  const existing = await findRegistrationWorkspace(client, {
    candidateId,
    registrationWindowId,
    registrationType,
    studentId,
  });
  if (existing) {
    if (!existing.registrationNumber) {
      return client.registrationWorkspace.update({
        where: { id: existing.id },
        data: {
          registrationNumber: await generateRegistrationNumber(registrationType, undefined, client),
          ...(studentId && !existing.studentId ? { studentId } : {}),
        },
      });
    }
    if (studentId && !existing.studentId) {
      return client.registrationWorkspace.update({
        where: { id: existing.id },
        data: { studentId },
      });
    }
    return existing;
  }

  return client.registrationWorkspace.create({
    data: {
      candidateId,
      studentId: studentId ?? null,
      registrationWindowId,
      registrationNumber: await generateRegistrationNumber(registrationType, undefined, client),
      ...workspaceDefaultsForType(registrationType),
    },
  });
}

export async function ensureRegistrationWorkspace(
  studentId: string,
  registrationWindowId: string,
  registrationType: RegistrationType = "INTERNAL_NORMAL",
) {
  const { syncCandidateFromStudentUser } = await import("@/lib/candidates/service");
  const candidate = await syncCandidateFromStudentUser(studentId);
  if (!candidate) {
    throw new Error("Could not resolve candidate for student");
  }
  return ensureRegistrationWorkspaceForCandidate(
    candidate.id,
    registrationWindowId,
    studentId,
    registrationType,
  );
}

async function realignRegistrationWorkspacesByType() {
  const workspaces = await prisma.registrationWorkspace.findMany({
    select: {
      id: true,
      candidateId: true,
      studentId: true,
      registrationWindowId: true,
      registrationType: true,
    },
  });

  for (const workspace of workspaces) {
    const registrations = await prisma.studentExamRegistration.findMany({
      where: { registrationWorkspaceId: workspace.id },
      select: { id: true, registrationType: true },
    });
    if (registrations.length === 0) continue;

    const registrationsByType = new Map<RegistrationType, string[]>();
    for (const registration of registrations) {
      const current = registrationsByType.get(registration.registrationType) ?? [];
      current.push(registration.id);
      registrationsByType.set(registration.registrationType, current);
    }

    if (registrationsByType.size === 1) {
      const [onlyType] = registrationsByType.keys();
      if (onlyType && workspace.registrationType !== onlyType) {
        await prisma.registrationWorkspace.update({
          where: { id: workspace.id },
          data: workspaceDefaultsForType(onlyType),
        });
      }
      continue;
    }

    for (const [registrationType, registrationIds] of registrationsByType) {
      if (!workspace.candidateId && !workspace.studentId) continue;

      let targetWorkspace =
        registrationType === workspace.registrationType
          ? workspace
          : workspace.candidateId
            ? await findRegistrationWorkspace(prisma, {
                candidateId: workspace.candidateId,
                registrationWindowId: workspace.registrationWindowId,
                registrationType,
                studentId: workspace.studentId,
              })
            : await prisma.registrationWorkspace.findFirst({
                where: {
                  studentId: workspace.studentId!,
                  registrationWindowId: workspace.registrationWindowId,
                  registrationType,
                },
              });

      if (!targetWorkspace) {
        targetWorkspace = await prisma.registrationWorkspace.create({
          data: {
            candidateId: workspace.candidateId,
            studentId: workspace.studentId,
            registrationWindowId: workspace.registrationWindowId,
            registrationNumber: await generateRegistrationNumber(registrationType),
            ...workspaceDefaultsForType(registrationType),
          },
        });
      } else if (targetWorkspace.id !== workspace.id) {
        await prisma.registrationWorkspace.update({
          where: { id: targetWorkspace.id },
          data: workspaceDefaultsForType(registrationType),
        });
      }

      if (targetWorkspace.id !== workspace.id) {
        await prisma.studentExamRegistration.updateMany({
          where: { id: { in: registrationIds } },
          data: { registrationWorkspaceId: targetWorkspace.id },
        });

        await prisma.registrationAuditLog.updateMany({
          where: { registrationId: { in: registrationIds } },
          data: { registrationWorkspaceId: targetWorkspace.id },
        });
      }
    }
  }
}

export async function backfillRegistrationWorkspaces() {
  await realignRegistrationWorkspacesByType();

  const rows = await prisma.studentExamRegistration.findMany({
    where: { registrationWorkspaceId: null },
    select: {
      id: true,
      studentId: true,
      candidateId: true,
      registrationWindowId: true,
      registrationType: true,
    },
  });

  const seen = new Set<string>();

  for (const row of rows) {
    const key = row.candidateId
      ? `c:${row.candidateId}:${row.registrationWindowId}:${row.registrationType}`
      : row.studentId
        ? `s:${row.studentId}:${row.registrationWindowId}:${row.registrationType}`
        : null;
    if (!key || seen.has(key)) continue;
    seen.add(key);

    let workspace;
    if (row.candidateId) {
      workspace = await ensureRegistrationWorkspaceForCandidate(
        row.candidateId,
        row.registrationWindowId,
        row.studentId,
        row.registrationType,
      );
    } else if (row.studentId) {
      workspace = await ensureRegistrationWorkspace(
        row.studentId,
        row.registrationWindowId,
        row.registrationType,
      );
    } else {
      continue;
    }

    await prisma.studentExamRegistration.updateMany({
      where: {
        registrationWindowId: row.registrationWindowId,
        registrationWorkspaceId: null,
        registrationType: row.registrationType,
        OR: [
          ...(row.candidateId ? [{ candidateId: row.candidateId }] : []),
          ...(row.studentId ? [{ studentId: row.studentId }] : []),
        ],
      },
      data: { registrationWorkspaceId: workspace.id },
    });
  }
}

export async function getRegistrationWorkspaceById(workspaceId: string) {
  await backfillRegistrationWorkspaces();

  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: workspaceId },
    include: workspaceInclude,
  });
  if (!workspace) return null;

  if (!workspace.confirmationNumber && workspace.lockedAt) {
    const confirmationNumber = await ensureWorkspaceConfirmationNumber(workspace);
    if (confirmationNumber) {
      return { ...workspace, confirmationNumber };
    }
  }

  return workspace;
}

export async function findWorkspaceForStudentWindow(
  studentId: string,
  registrationWindowId: string,
  registrationType: RegistrationType = "INTERNAL_NORMAL",
) {
  await backfillRegistrationWorkspaces();

  return prisma.registrationWorkspace.findFirst({
    where: {
      studentId,
      registrationWindowId,
      registrationType,
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
