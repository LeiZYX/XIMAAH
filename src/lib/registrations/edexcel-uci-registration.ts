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
 * After a subject is added to an Edexcel workspace (Internal or External):
 * - snapshot UCI at first touch
 * - Internal only: allocate provisional UCI when empty (Centre + B + school number last 6)
 * - force Candidate Registration Fee when UCI empty or without trailing letter
 * - External empty UCI: do not allocate (99xxxx deferred); still charge the fee
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
  if (!candidate) return;
  if (candidate.candidateType !== "INTERNAL" && candidate.candidateType !== "EXTERNAL") {
    return;
  }

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

  // Internal only: auto-allocate provisional UCI when empty. External 99xxxx deferred.
  if (!nextUci && candidate.candidateType === "INTERNAL") {
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
 * Pure gate for tests and evaluateRegistrationFeeRemovalGate.
 *
 * - No subjects → fee may be removed
 * - clearUci only when entry UCI was empty and system-allocated, and no Bulk baseline
 * - Imported / pre-existing UCI: remove fee, keep UCI
 */
export function computeEdexcelRegistrationFeeRemovalGate(input: {
  activeSubjectCount: number;
  uciEntrySnapshotCaptured: boolean;
  uciAtEntry: string | null | undefined;
  uciAllocatedBySystem: boolean;
  hasBulkEntriesBaseline: boolean;
}): RegistrationFeeRemovalGate {
  if (input.activeSubjectCount > 0) {
    return {
      allowed: false,
      clearUci: false,
      reason: "Candidate Registration Fee cannot be removed while exam subjects remain",
    };
  }

  const startedEmpty =
    input.uciEntrySnapshotCaptured &&
    (input.uciAtEntry == null || input.uciAtEntry.trim() === "");
  const clearUci = Boolean(startedEmpty && input.uciAllocatedBySystem);

  if (clearUci && input.hasBulkEntriesBaseline) {
    return {
      allowed: false,
      clearUci: false,
      reason:
        "Candidate Registration Fee and UCI cannot be cleared after Bulk Entries baseline was submitted",
    };
  }

  return { allowed: true, clearUci };
}

/**
 * Registration fee may be removed when no active/locked subjects remain.
 * System-allocated provisional UCI is cleared only when UCI was empty at entry
 * and Bulk Entries baseline has not been submitted. Pre-existing UCIs are kept.
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
  const baseline = await hasBulkEntriesBaseline(workspace.registrationWindowId);

  return computeEdexcelRegistrationFeeRemovalGate({
    activeSubjectCount: activeCount,
    uciEntrySnapshotCaptured: workspace.uciEntrySnapshotCaptured,
    uciAtEntry: workspace.uciAtEntry,
    uciAllocatedBySystem: workspace.uciAllocatedBySystem,
    hasBulkEntriesBaseline: baseline,
  });
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
 * After subjects are removed: if none remain and clearance is allowed, drop fee
 * (and clear system-allocated UCI only when the gate says so).
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
    reason:
      params.reason?.trim() ||
      (gate.clearUci
        ? "All subjects removed; cleared system-allocated provisional UCI"
        : "All subjects removed; Candidate Registration Fee removed (UCI unchanged)"),
    tx: params.tx,
    skipRemovalGate: true,
    clearUciOnRemove: gate.clearUci,
  });
}
