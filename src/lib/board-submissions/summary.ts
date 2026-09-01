import { roundMoney, toNumber } from "@/lib/fees/money";
import type { RegistrationFeeStageRecord } from "@/lib/registrations/fee-stages";
import { prisma } from "@/lib/prisma";
import {
  buildBoardSubmissionTimeline,
  recommendBoardSubmissionsTab,
  resolveBoardSubmissionPhaseLabel,
} from "@/lib/board-submissions/timeline";
import type { BoardSubmissionWindowSummary } from "@/lib/board-submissions/types";

function isInternalRegistrationType(registrationType: string): boolean {
  return registrationType === "INTERNAL_NORMAL" || registrationType === "RESTRICTED_INTERNAL";
}

export async function buildBoardSubmissionWindowSummary(
  registrationWindowId: string,
  now = new Date(),
): Promise<BoardSubmissionWindowSummary | null> {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: registrationWindowId },
    include: {
      examBoard: { select: { id: true, name: true, code: true } },
      examSeries: { select: { id: true, name: true, year: true } },
      feeStages: { orderBy: { sequence: "asc" } },
      boardSubmissionBaselines: {
        orderBy: { version: "desc" },
        take: 1,
        include: { submittedBy: { select: { name: true } } },
      },
    },
  });

  if (!window) return null;

  const feeStages = window.feeStages as RegistrationFeeStageRecord[];
  const phase = resolveBoardSubmissionPhaseLabel(window, feeStages, now);
  const timeline = buildBoardSubmissionTimeline(window, feeStages, now);

  const [baselineCount, lockedWorkspaces, statements, offlineRefunds] = await Promise.all([
    prisma.boardSubmissionBaseline.count({ where: { registrationWindowId } }),
    prisma.registrationWorkspace.findMany({
      where: {
        registrationWindowId,
        lockedAt: { not: null },
      },
      select: {
        id: true,
        candidateId: true,
        registrationType: true,
        candidate: {
          select: {
            id: true,
            examIdentities: {
              where: { examBoardId: window.examBoardId, status: { not: "ARCHIVED" } },
              select: { candidateNumber: true, uciNumber: true },
            },
          },
        },
        registrations: {
          where: { status: { in: ["ACTIVE", "LOCKED"] } },
          select: { id: true },
        },
      },
    }),
    prisma.feeStatement.findMany({
      where: {
        registrationWindowId,
        status: { notIn: ["REVISED", "CANCELLED"] },
      },
      select: {
        status: true,
        totalGbpAmount: true,
        amountDueGbpAmount: true,
        previouslyPaidGbpAmount: true,
        registrationWorkspaceId: true,
        generatedAt: true,
      },
      orderBy: { generatedAt: "desc" },
    }),
    prisma.offlineWithdrawalRefund.findMany({
      where: { registrationWindowId },
      select: {
        status: true,
        creditGbp: true,
        salesAmountGbp: true,
        paymentFeePercent: true,
      },
    }),
  ]);

  const candidateIds = new Set<string>();
  const internalCandidateIds = new Set<string>();
  const externalCandidateIds = new Set<string>();
  let examEntryCount = 0;
  let missingIdentityCount = 0;

  for (const workspace of lockedWorkspaces) {
    if (!workspace.candidateId) continue;
    candidateIds.add(workspace.candidateId);
    if (isInternalRegistrationType(workspace.registrationType)) {
      internalCandidateIds.add(workspace.candidateId);
    } else {
      externalCandidateIds.add(workspace.candidateId);
    }
    examEntryCount += workspace.registrations.length;

    const identity = workspace.candidate?.examIdentities[0];
    if (!identity?.candidateNumber?.trim() || !identity?.uciNumber?.trim()) {
      missingIdentityCount += 1;
    }
  }

  const latestStatementByWorkspace = new Map<string, (typeof statements)[number]>();
  for (const statement of statements) {
    if (!statement.registrationWorkspaceId) continue;
    if (!latestStatementByWorkspace.has(statement.registrationWorkspaceId)) {
      latestStatementByWorkspace.set(statement.registrationWorkspaceId, statement);
    }
  }

  let totalReceivableGbp = 0;
  let amountDueGbp = 0;
  let paidGbp = 0;
  let uncertainGbp = 0;

  for (const statement of latestStatementByWorkspace.values()) {
    const total = toNumber(statement.totalGbpAmount);
    totalReceivableGbp += total;

    if (statement.status === "PAID") {
      paidGbp += total;
    } else if (statement.status === "ISSUED") {
      amountDueGbp += toNumber(statement.amountDueGbpAmount ?? statement.totalGbpAmount);
    } else if (statement.status === "DRAFT" || statement.status === "NEEDS_REGENERATION") {
      uncertainGbp += total;
    }
  }

  let pendingRefundGbp = 0;
  let completedRefundGbp = 0;
  let platformFeeGbp = 0;

  for (const refund of offlineRefunds) {
    const credit = toNumber(refund.creditGbp);
    const sales = toNumber(refund.salesAmountGbp);
    const feePercent = toNumber(refund.paymentFeePercent);
    platformFeeGbp += roundMoney((sales * feePercent) / 100);

    if (refund.status === "PENDING_OFFLINE") {
      pendingRefundGbp += credit;
    } else if (refund.status === "COMPLETED") {
      completedRefundGbp += credit;
    }
  }

  const latestBaseline = window.boardSubmissionBaselines[0] ?? null;
  const hasBaseline = baselineCount > 0;

  return {
    window: {
      id: window.id,
      title: window.title,
      status: window.status,
      academicYear: window.academicYear,
      studentRegistrationOpenAt: window.studentRegistrationOpenAt.toISOString(),
      studentRegistrationCloseAt: window.studentRegistrationCloseAt.toISOString(),
      registrationCloseAt: window.registrationCloseAt.toISOString(),
      examBoard: window.examBoard,
      examSeries: window.examSeries,
    },
    currentPhaseLabel: phase.label,
    currentPhaseDetail: phase.detail,
    studentState: phase.studentState,
    currentFeeStage: phase.currentFeeStage,
    timeline,
    nowAt: now.toISOString(),
    baseline: {
      status: hasBaseline ? "ESTABLISHED" : "NONE",
      versionCount: baselineCount,
      latest: latestBaseline
        ? {
            version: latestBaseline.version,
            kind: latestBaseline.kind,
            submittedAt: latestBaseline.submittedAt.toISOString(),
            submittedByName: latestBaseline.submittedBy?.name ?? null,
            candidateCount: latestBaseline.candidateCount,
            entryCount: latestBaseline.entryCount,
            fileCount: latestBaseline.fileCount,
            notes: latestBaseline.notes,
          }
        : null,
    },
    registration: {
      candidateCount: candidateIds.size,
      examEntryCount,
      internalCandidateCount: internalCandidateIds.size,
      externalCandidateCount: externalCandidateIds.size,
      missingIdentityCount,
    },
    financial: {
      totalReceivableGbp: roundMoney(totalReceivableGbp),
      amountDueGbp: roundMoney(amountDueGbp),
      paidGbp: roundMoney(paidGbp),
      pendingRefundGbp: roundMoney(pendingRefundGbp),
      completedRefundGbp: roundMoney(completedRefundGbp),
      uncertainGbp: roundMoney(uncertainGbp),
      platformFeeGbp: roundMoney(platformFeeGbp),
    },
    recommendedTab: recommendBoardSubmissionsTab(window, feeStages, hasBaseline, now),
  };
}
