import type { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";
import { hasBulkEntriesBaseline } from "@/lib/board-submissions/baseline";
import {
  deriveInternalProvisionalUci,
  examBoardUsesEdexcelUciRules,
  needsCandidateRegistrationFeeForUci,
} from "@/lib/candidates/uci-allocation";
import { applyCandidateRegistrationFeeSelection } from "@/lib/fees/candidate-registration-fee";
import { prisma } from "@/lib/prisma";
import { RegistrationError } from "@/lib/registrations/errors";

type DbClient = Prisma.TransactionClient | typeof prisma;

async function countActiveSubjectsInWorkspace(
  workspaceId: string,
  client: DbClient = prisma,
): Promise<number> {
  return client.studentExamRegistration.count({
    where: {
      registrationWorkspaceId: workspaceId,
      status: { in: ["ACTIVE", "LOCKED"] },
    },
  });
}

/**
 * After a subject is added to an Internal Edexcel workspace:
 * - snapshot UCI at first touch
 * - allocate provisional UCI when empty (Centre + B + school number last 6)
 * - force Candidate Registration Fee when UCI empty or without trailing letter
 */
export async function ensureEdexcelUciAndRegistrationFeeOnSubjectAdd(params: {
  workspaceId: string;
  performedBy: { id: string; role: UserRole };
  reason?: string | null;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const client = params.tx ?? prisma;

  const workspace = await client.registrationWorkspace.findUnique({
    where: { id: params.workspaceId },
    select: {
      id: true,
      candidateId: true,
      studentId: true,
      registrationType: true,
      includeCandidateRegistrationFee: true,
      uciAtEntry: true,
      uciEntrySnapshotCaptured: true,
      uciAllocatedBySystem: true,
      registrationWindow: {
        select: {
          id: true,
          examBoardId: true,
          examBoard: {
            select: { id: true, code: true, name: true, centreNumber: true },
          },
        },
      },
    },
  });

  if (!workspace?.candidateId) return;
  if (workspace.registrationType === "EXTERNAL") return;

  const board = workspace.registrationWindow.examBoard;
  if (!examBoardUsesEdexcelUciRules(board.code, board.name)) return;

  const candidate = await client.candidate.findUnique({
    where: { id: workspace.candidateId },
    select: {
      id: true,
      candidateType: true,
      studentNumber: true,
      user: { select: { studentProfile: { select: { studentNo: true } } } },
    },
  });
  if (!candidate || candidate.candidateType !== "INTERNAL") return;

  let identity = await client.candidateExamIdentity.findUnique({
    where: {
      candidateId_examBoardId: {
        candidateId: candidate.id,
        examBoardId: board.id,
      },
    },
  });

  const currentUci = identity?.uciNumber?.trim() || null;

  if (!workspace.uciEntrySnapshotCaptured) {
    await client.registrationWorkspace.update({
      where: { id: workspace.id },
      data: {
        uciAtEntry: currentUci,
        uciEntrySnapshotCaptured: true,
      },
    });
    workspace.uciAtEntry = currentUci;
    workspace.uciEntrySnapshotCaptured = true;
  }

  let nextUci = currentUci;
  let allocatedBySystem = workspace.uciAllocatedBySystem;

  if (!nextUci) {
    const schoolNo =
      candidate.studentNumber?.trim() ||
      candidate.user?.studentProfile?.studentNo?.trim() ||
      "";
    let allocated: string;
    try {
      allocated = deriveInternalProvisionalUci(board.centreNumber, schoolNo);
    } catch (error) {
      throw new RegistrationError(
        error instanceof Error ? error.message : "Could not allocate provisional UCI",
        400,
      );
    }

    const centre = board.centreNumber?.trim() || null;
    if (!identity) {
      identity = await client.candidateExamIdentity.create({
        data: {
          candidateId: candidate.id,
          examBoardId: board.id,
          centreNumber: centre,
          uciNumber: allocated,
          status: "PENDING",
          createdByUserId: params.performedBy.id,
          updatedByUserId: params.performedBy.id,
        },
      });
    } else {
      identity = await client.candidateExamIdentity.update({
        where: { id: identity.id },
        data: {
          uciNumber: allocated,
          centreNumber: identity.centreNumber?.trim() || centre,
          updatedByUserId: params.performedBy.id,
        },
      });
    }

    nextUci = allocated;
    allocatedBySystem = true;
    await client.registrationWorkspace.update({
      where: { id: workspace.id },
      data: { uciAllocatedBySystem: true },
    });
  }

  if (needsCandidateRegistrationFeeForUci(nextUci) && !workspace.includeCandidateRegistrationFee) {
    await applyCandidateRegistrationFeeSelection({
      workspaceId: workspace.id,
      includeCandidateRegistrationFee: true,
      performedBy: params.performedBy,
      reason:
        params.reason?.trim() ||
        "Edexcel candidate registration fee required (UCI missing or not board-confirmed)",
      tx: params.tx,
    });
  }
}

export type RegistrationFeeRemovalGate = {
  allowed: boolean;
  clearUci: boolean;
  reason?: string;
};

/**
 * Registration fee may be removed (and system UCI cleared) only when:
 * - no active/locked subjects remain
 * - UCI was empty at workspace entry and was system-allocated
 * - Bulk Entries baseline has not been submitted
 */
export async function evaluateRegistrationFeeRemovalGate(
  workspaceId: string,
  client: DbClient = prisma,
): Promise<RegistrationFeeRemovalGate> {
  const workspace = await client.registrationWorkspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      includeCandidateRegistrationFee: true,
      uciAtEntry: true,
      uciEntrySnapshotCaptured: true,
      uciAllocatedBySystem: true,
      registrationWindowId: true,
      registrationWindow: {
        select: {
          examBoard: { select: { code: true, name: true } },
        },
      },
    },
  });

  if (!workspace) {
    return { allowed: false, clearUci: false, reason: "Registration workspace not found" };
  }

  if (
    !examBoardUsesEdexcelUciRules(
      workspace.registrationWindow.examBoard.code,
      workspace.registrationWindow.examBoard.name,
    )
  ) {
    return { allowed: true, clearUci: false };
  }

  const activeCount = await countActiveSubjectsInWorkspace(workspaceId, client);
  if (activeCount > 0) {
    return {
      allowed: false,
      clearUci: false,
      reason: "Candidate Registration Fee cannot be removed while exam subjects remain",
    };
  }

  const startedEmpty =
    workspace.uciEntrySnapshotCaptured &&
    (workspace.uciAtEntry == null || workspace.uciAtEntry.trim() === "");
  if (!startedEmpty || !workspace.uciAllocatedBySystem) {
    return {
      allowed: false,
      clearUci: false,
      reason:
        "Candidate Registration Fee cannot be removed because a UCI already existed when registration started",
    };
  }

  if (await hasBulkEntriesBaseline(workspace.registrationWindowId)) {
    return {
      allowed: false,
      clearUci: false,
      reason:
        "Candidate Registration Fee and UCI cannot be cleared after Bulk Entries baseline was submitted",
    };
  }

  return { allowed: true, clearUci: true };
}

/** Clear system-allocated provisional UCI when fee removal is allowed. */
export async function clearSystemAllocatedUciIfNeeded(params: {
  workspaceId: string;
  performedByUserId: string;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const client = params.tx ?? prisma;
  const workspace = await client.registrationWorkspace.findUnique({
    where: { id: params.workspaceId },
    select: {
      id: true,
      candidateId: true,
      uciAllocatedBySystem: true,
      registrationWindow: { select: { examBoardId: true } },
    },
  });
  if (!workspace?.candidateId || !workspace.uciAllocatedBySystem) return;

  const identity = await client.candidateExamIdentity.findUnique({
    where: {
      candidateId_examBoardId: {
        candidateId: workspace.candidateId,
        examBoardId: workspace.registrationWindow.examBoardId,
      },
    },
    select: { id: true },
  });
  if (identity) {
    await client.candidateExamIdentity.update({
      where: { id: identity.id },
      data: {
        uciNumber: null,
        updatedByUserId: params.performedByUserId,
      },
    });
  }

  await client.registrationWorkspace.update({
    where: { id: workspace.id },
    data: {
      uciAllocatedBySystem: false,
      uciAtEntry: null,
      uciEntrySnapshotCaptured: false,
    },
  });
}

/**
 * After subjects are removed: if none remain and clearance is allowed, drop fee + UCI.
 */
export async function maybeClearEdexcelRegistrationFeeAndUciAfterSubjectRemoval(params: {
  workspaceId: string;
  performedBy: { id: string; role: UserRole };
  reason?: string | null;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const client = params.tx ?? prisma;
  const workspace = await client.registrationWorkspace.findUnique({
    where: { id: params.workspaceId },
    select: {
      id: true,
      includeCandidateRegistrationFee: true,
      registrationWindow: {
        select: { examBoard: { select: { code: true, name: true } } },
      },
    },
  });
  if (!workspace) return;
  if (
    !examBoardUsesEdexcelUciRules(
      workspace.registrationWindow.examBoard.code,
      workspace.registrationWindow.examBoard.name,
    )
  ) {
    return;
  }

  const gate = await evaluateRegistrationFeeRemovalGate(workspace.id, client);
  if (!gate.allowed || !workspace.includeCandidateRegistrationFee) {
    return;
  }

  await applyCandidateRegistrationFeeSelection({
    workspaceId: workspace.id,
    includeCandidateRegistrationFee: false,
    performedBy: params.performedBy,
    reason: params.reason?.trim() || "All subjects removed before Bulk Entries baseline",
    tx: params.tx,
    skipRemovalGate: true,
    clearUciOnRemove: gate.clearUci,
  });
}
