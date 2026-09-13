import type { FeeEntryType, OfflineWithdrawalRefundStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { createFeeAuditLog } from "@/lib/fees/audit";
import { calculateFeeAmounts } from "@/lib/fees/calculate";
import { findMatchingFeeRuleWithFallback, resolveEntryTypeForRegistration } from "@/lib/fees/match";
import { roundMoney, toNumber } from "@/lib/fees/money";
import { sumWorkspacePaidGbp } from "@/lib/fees/payment-due";
import {
  DEFAULT_PAYMENT_FEE_PERCENT,
  effectiveWithdrawalRefundPercent,
} from "@/lib/fees/withdrawal-policy";
import { resolveActiveFeeStage, type RegistrationFeeStageRecord } from "@/lib/registrations/fee-stages";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

export type WithdrawalRefundCalculation = {
  salesAmountGbp: number;
  salesAmountCny: number | null;
  configuredRefundPercent: number;
  paymentFeePercent: number;
  effectiveRefundPercent: number;
  creditGbp: number;
  creditCny: number | null;
  feeStageCode: FeeEntryType;
  policyNotes: string | null;
  calculationNotes: string;
  status: OfflineWithdrawalRefundStatus;
};

export function computeWithdrawalCredit(params: {
  salesAmountGbp: number;
  salesAmountCny?: number | null;
  refundEnabled: boolean;
  configuredPercent: number;
  paymentFeePercent: number;
  feeStageCode: FeeEntryType;
  policyNotes?: string | null;
  sourceNote: string;
}): WithdrawalRefundCalculation {
  const salesAmountGbp = roundMoney(Math.max(0, params.salesAmountGbp));
  const salesAmountCny =
    params.salesAmountCny == null ? null : roundMoney(Math.max(0, params.salesAmountCny));
  const configuredRefundPercent = params.refundEnabled ? params.configuredPercent : 0;
  const paymentFeePercent = params.paymentFeePercent;
  const effectiveRefundPercent = effectiveWithdrawalRefundPercent({
    refundEnabled: params.refundEnabled,
    configuredPercent: configuredRefundPercent,
    paymentFeePercent,
  });
  const creditGbp = roundMoney((salesAmountGbp * effectiveRefundPercent) / 100);
  const creditCny =
    salesAmountCny == null ? null : roundMoney((salesAmountCny * effectiveRefundPercent) / 100);

  const status: OfflineWithdrawalRefundStatus =
    creditGbp > 0 ? "PENDING_OFFLINE" : "ZERO_NO_REFUND";

  return {
    salesAmountGbp,
    salesAmountCny,
    configuredRefundPercent,
    paymentFeePercent,
    effectiveRefundPercent,
    creditGbp,
    creditCny,
    feeStageCode: params.feeStageCode,
    policyNotes: params.policyNotes ?? null,
    calculationNotes: [
      params.sourceNote,
      `Stage ${params.feeStageCode}`,
      params.refundEnabled
        ? `Configured ${configuredRefundPercent}%, payment fee ${paymentFeePercent}%, effective ${effectiveRefundPercent}%`
        : "Refunds disabled for this stage",
      `Credit £${creditGbp.toFixed(2)} (offline finance only — not via payment platform)`,
    ].join(" · "),
    status,
  };
}

async function resolveBilledSalesForSession(params: {
  workspaceId: string;
  examSessionId: string;
  registration: {
    examBoardId: string;
    examSeriesId: string;
    subjectId: string;
    paperId: string;
    examSessionId: string;
    entryType: FeeEntryType;
    registrationWindowId: string;
    subject: { qualificationId: string };
  };
  workspaceEntryType: FeeEntryType;
}): Promise<{ salesGbp: number; salesCny: number | null; sourceNote: string } | null> {
  const statementItem = await prisma.feeStatementItem.findFirst({
    where: {
      examSessionId: params.examSessionId,
      feeStatement: {
        registrationWorkspaceId: params.workspaceId,
        statementKind: "NORMAL",
        status: { in: ["ISSUED", "PAID", "NEEDS_REGENERATION"] },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      lineTotalGbp: true,
      lineTotalCny: true,
      salesGbpAmountSnapshot: true,
      salesCnyAmountSnapshot: true,
    },
  });

  if (statementItem) {
    const salesGbp = toNumber(
      statementItem.salesGbpAmountSnapshot ?? statementItem.lineTotalGbp,
    );
    const salesCny = toNumber(
      statementItem.salesCnyAmountSnapshot ?? statementItem.lineTotalCny,
    );
    return {
      salesGbp,
      salesCny,
      sourceNote: "Sales amount from latest billed fee statement line",
    };
  }

  const rules = await prisma.feeRule.findMany({
    where: { registrationWindowId: params.registration.registrationWindowId, isActive: true },
  });
  const exchangeRates = await prisma.exchangeRate.findMany({
    where: { registrationWindowId: params.registration.registrationWindowId },
    orderBy: { effectiveDate: "desc" },
  });
  const entryType = resolveEntryTypeForRegistration(
    { entryType: params.registration.entryType },
    { entryType: params.workspaceEntryType },
  );
  const rule = findMatchingFeeRuleWithFallback(rules, {
    examBoardId: params.registration.examBoardId,
    examSeriesId: params.registration.examSeriesId,
    qualificationId: params.registration.subject.qualificationId,
    subjectId: params.registration.subjectId,
    paperId: params.registration.paperId,
    examSessionId: params.registration.examSessionId,
    entryType,
  });
  if (!rule) return null;

  const amounts = calculateFeeAmounts(rule, exchangeRates);
  return {
    salesGbp: amounts.salesGbp,
    salesCny: amounts.salesCny,
    sourceNote: `Sales amount from fee rule (${entryType})`,
  };
}

export async function recordOfflineWithdrawalRefundsForRemovals(params: {
  workspaceId: string;
  registrationIds: string[];
  performedByUserId: string;
  now?: Date;
}): Promise<WithdrawalRefundCalculation[]> {
  const uniqueIds = [...new Set(params.registrationIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const workspace = await prisma.registrationWorkspace.findUnique({
    where: { id: params.workspaceId },
    include: {
      registrationWindow: {
        include: {
          feeStages: { orderBy: { sequence: "asc" } },
        },
      },
      registrations: {
        where: { id: { in: uniqueIds } },
        include: {
          subject: { select: { name: true, qualificationId: true } },
          paper: { select: { code: true, title: true } },
        },
      },
    },
  });
  if (!workspace) return [];

  const now = params.now ?? new Date();
  const feeStages = workspace.registrationWindow.feeStages as RegistrationFeeStageRecord[];
  const activeStage = resolveActiveFeeStage(feeStages, now);
  const feeStageCode = activeStage?.stageCode ?? "NORMAL";
  const stageRow =
    feeStages.find((stage) => stage.stageCode === feeStageCode) ??
    feeStages.find((stage) => stage.stageCode === "NORMAL") ??
    null;

  const paymentFeePercent = toNumber(
    workspace.registrationWindow.paymentFeePercent ?? DEFAULT_PAYMENT_FEE_PERCENT,
  );
  const refundEnabled = stageRow?.withdrawalRefundEnabled ?? feeStageCode !== "HIGH_LATE";
  const configuredPercent = toNumber(
    stageRow?.withdrawalRefundPercent ??
      (feeStageCode === "LATE" ? 50 : feeStageCode === "HIGH_LATE" ? 0 : 100),
  );
  const policyNotes = stageRow?.withdrawalNotes ?? null;

  const results: WithdrawalRefundCalculation[] = [];

  for (const registration of workspace.registrations) {
    const billed = await resolveBilledSalesForSession({
      workspaceId: workspace.id,
      examSessionId: registration.examSessionId,
      registration: {
        examBoardId: registration.examBoardId,
        examSeriesId: registration.examSeriesId,
        subjectId: registration.subjectId,
        paperId: registration.paperId,
        examSessionId: registration.examSessionId,
        entryType: registration.entryType,
        registrationWindowId: registration.registrationWindowId,
        subject: registration.subject,
      },
      workspaceEntryType: workspace.entryType,
    });

    if (!billed) {
      continue;
    }

    // Avoid duplicate pending rows for the same cancelled registration/session.
    const existingPending = await prisma.offlineWithdrawalRefund.findFirst({
      where: {
        registrationWorkspaceId: workspace.id,
        examSessionId: registration.examSessionId,
        registrationId: registration.id,
        status: "PENDING_OFFLINE",
      },
      select: { id: true },
    });
    if (existingPending) continue;

    const calc = computeWithdrawalCredit({
      salesAmountGbp: billed.salesGbp,
      salesAmountCny: billed.salesCny,
      refundEnabled,
      configuredPercent,
      paymentFeePercent,
      feeStageCode,
      policyNotes,
      sourceNote: billed.sourceNote,
    });

    const row = await prisma.offlineWithdrawalRefund.create({
      data: {
        registrationWorkspaceId: workspace.id,
        registrationWindowId: workspace.registrationWindowId,
        candidateId: workspace.candidateId,
        studentId: workspace.studentId,
        registrationId: registration.id,
        examSessionId: registration.examSessionId,
        paperCodeSnapshot: registration.paper.code,
        subjectSnapshot: registration.subject.name,
        feeStageCode: calc.feeStageCode,
        salesAmountGbp: calc.salesAmountGbp,
        salesAmountCny: calc.salesAmountCny,
        configuredRefundPercent: calc.configuredRefundPercent,
        paymentFeePercent: calc.paymentFeePercent,
        effectiveRefundPercent: calc.effectiveRefundPercent,
        creditGbp: calc.creditGbp,
        creditCny: calc.creditCny,
        status: calc.status,
        policyNotes: calc.policyNotes,
        calculationNotes: calc.calculationNotes,
        createdByUserId: params.performedByUserId,
      },
    });

    await createFeeAuditLog({
      action: "OFFLINE_WITHDRAWAL_REFUND_RECORDED",
      performedByUserId: params.performedByUserId,
      registrationWindowId: workspace.registrationWindowId,
      note: `${registration.paper.code}: ${calc.calculationNotes}`,
      metadata: {
        offlineWithdrawalRefundId: row.id,
        workspaceId: workspace.id,
        registrationId: registration.id,
        examSessionId: registration.examSessionId,
        status: calc.status,
        creditGbp: calc.creditGbp,
        effectiveRefundPercent: calc.effectiveRefundPercent,
        feeStageCode: calc.feeStageCode,
      },
    }).catch((error) => {
      console.error("Fee audit log failed:", error);
    });

    results.push(calc);
  }

  return results;
}

export function summarizeWithdrawalRefunds(calcs: WithdrawalRefundCalculation[]): string | null {
  if (calcs.length === 0) return null;
  const pending = calcs.filter((row) => row.status === "PENDING_OFFLINE");
  const totalCredit = roundMoney(pending.reduce((sum, row) => sum + row.creditGbp, 0));
  if (pending.length === 0) {
    return `Withdrawal recorded with no offline refund due (${calcs.length} item${calcs.length === 1 ? "" : "s"}).`;
  }
  return `Offline refund pending: £${totalCredit.toFixed(2)} across ${pending.length} removal${pending.length === 1 ? "" : "s"} (finance processes outside payment platform).`;
}

export async function completeOfflineWithdrawalRefund(params: {
  id: string;
  performedByUserId: string;
  offlineReference?: string | null;
  offlineNote?: string | null;
}) {
  const existing = await prisma.offlineWithdrawalRefund.findUnique({ where: { id: params.id } });
  if (!existing) return { error: "Refund record not found", status: 404 as const };
  if (existing.status !== "PENDING_OFFLINE") {
    return { error: "Only pending offline refunds can be marked completed", status: 400 as const };
  }

  const updated = await prisma.offlineWithdrawalRefund.update({
    where: { id: params.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedByUserId: params.performedByUserId,
      offlineReference: params.offlineReference?.trim() || null,
      offlineNote: params.offlineNote?.trim() || null,
    },
    include: {
      candidate: { select: { englishName: true, studentNumber: true } },
      examSession: {
        select: {
          paper: { select: { code: true } },
        },
      },
      createdByUser: { select: { id: true, name: true } },
      completedByUser: { select: { id: true, name: true } },
    },
  });

  await createFeeAuditLog({
    action: "OFFLINE_WITHDRAWAL_REFUND_COMPLETED",
    performedByUserId: params.performedByUserId,
    registrationWindowId: updated.registrationWindowId,
    note: `Marked offline refund completed for ${updated.paperCodeSnapshot} (£${toNumber(updated.creditGbp).toFixed(2)})`,
    metadata: {
      offlineWithdrawalRefundId: updated.id,
      offlineReference: updated.offlineReference,
      creditGbp: toNumber(updated.creditGbp),
    },
  }).catch((error) => {
    console.error("Fee audit log failed:", error);
  });

  return { refund: updated };
}

export async function listOfflineWithdrawalRefunds(params: {
  status?: OfflineWithdrawalRefundStatus | "ALL";
  registrationWindowId?: string;
}) {
  return prisma.offlineWithdrawalRefund.findMany({
    where: {
      ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
      ...(params.registrationWindowId
        ? { registrationWindowId: params.registrationWindowId }
        : {}),
    },
    include: {
      candidate: {
        select: {
          id: true,
          englishName: true,
          chineseName: true,
          studentNumber: true,
          assessmentHubCandidateNumber: true,
        },
      },
      registrationWindow: {
        select: { id: true, title: true, academicYear: true },
      },
      registrationWorkspace: {
        select: { id: true, registrationNumber: true },
      },
      createdByUser: { select: { id: true, name: true } },
      completedByUser: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

function serializeRefundLine(
  row: Awaited<ReturnType<typeof listOfflineWithdrawalRefunds>>[number],
) {
  return {
    id: row.id,
    status: row.status,
    paperCodeSnapshot: row.paperCodeSnapshot,
    subjectSnapshot: row.subjectSnapshot,
    feeStageCode: row.feeStageCode,
    salesAmountGbp: toNumber(row.salesAmountGbp),
    configuredRefundPercent: toNumber(row.configuredRefundPercent),
    paymentFeePercent: toNumber(row.paymentFeePercent),
    effectiveRefundPercent: toNumber(row.effectiveRefundPercent),
    creditGbp: toNumber(row.creditGbp),
    calculationNotes: row.calculationNotes,
    offlineReference: row.offlineReference,
    offlineNote: row.offlineNote,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    createdByUser: row.createdByUser,
    completedByUser: row.completedByUser,
  };
}

/**
 * Finance work queue: group withdrawal refund lines by registration workspace and
 * attach the latest active fee statement totals (revised total / already paid / due).
 */
export async function listOfflineWithdrawalRefundGroups(params: {
  status?: OfflineWithdrawalRefundStatus | "ALL";
  registrationWindowId?: string;
}) {
  const lines = await listOfflineWithdrawalRefunds(params);
  const workspaceIds = [...new Set(lines.map((row) => row.registrationWorkspaceId))];

  const statements =
    workspaceIds.length === 0
      ? []
      : await prisma.feeStatement.findMany({
          where: {
            registrationWorkspaceId: { in: workspaceIds },
            statementKind: "NORMAL",
            status: { in: ["DRAFT", "ISSUED", "PAID", "NEEDS_REGENERATION"] },
          },
          select: {
            id: true,
            statementNo: true,
            status: true,
            totalGbpAmount: true,
            previouslyPaidGbpAmount: true,
            amountDueGbpAmount: true,
            paymentNotes: true,
            registrationWorkspaceId: true,
            generatedAt: true,
          },
          orderBy: { generatedAt: "desc" },
        });

  const latestStatementByWorkspace = new Map<string, (typeof statements)[number]>();
  for (const statement of statements) {
    const workspaceId = statement.registrationWorkspaceId;
    if (!workspaceId || latestStatementByWorkspace.has(workspaceId)) continue;
    latestStatementByWorkspace.set(workspaceId, statement);
  }

  const revisedStatements =
    workspaceIds.length === 0
      ? []
      : await prisma.feeStatement.findMany({
          where: {
            registrationWorkspaceId: { in: workspaceIds },
            statementKind: "NORMAL",
            status: "REVISED",
          },
          select: {
            registrationWorkspaceId: true,
            totalGbpAmount: true,
            generatedAt: true,
          },
          orderBy: { generatedAt: "desc" },
        });

  const priorBilledByWorkspace = new Map<string, number>();
  for (const statement of revisedStatements) {
    const workspaceId = statement.registrationWorkspaceId;
    if (!workspaceId || priorBilledByWorkspace.has(workspaceId)) continue;
    priorBilledByWorkspace.set(workspaceId, toNumber(statement.totalGbpAmount));
  }

  const onlinePaidByWorkspace = new Map<string, number>();
  await Promise.all(
    workspaceIds.map(async (workspaceId) => {
      onlinePaidByWorkspace.set(workspaceId, await sumWorkspacePaidGbp(workspaceId));
    }),
  );

  const groupMap = new Map<
    string,
    {
      workspaceId: string;
      registrationNumber: string | null;
      candidate: {
        id: string;
        englishName: string;
        chineseName: string | null;
        studentNumber: string | null;
        assessmentHubCandidateNumber: string;
      } | null;
      registrationWindow: { id: string; title: string; academicYear: string };
      lines: ReturnType<typeof serializeRefundLine>[];
    }
  >();

  for (const row of lines) {
    const existing = groupMap.get(row.registrationWorkspaceId);
    const serialized = serializeRefundLine(row);
    if (existing) {
      existing.lines.push(serialized);
      continue;
    }
    groupMap.set(row.registrationWorkspaceId, {
      workspaceId: row.registrationWorkspaceId,
      registrationNumber: row.registrationWorkspace.registrationNumber,
      candidate: row.candidate
        ? {
            id: row.candidate.id,
            englishName: row.candidate.englishName,
            chineseName: row.candidate.chineseName,
            studentNumber: row.candidate.studentNumber,
            assessmentHubCandidateNumber: row.candidate.assessmentHubCandidateNumber,
          }
        : null,
      registrationWindow: row.registrationWindow,
      lines: [serialized],
    });
  }

  const groups = [...groupMap.values()].map((group) => {
    const pendingLines = group.lines.filter((line) => line.status === "PENDING_OFFLINE");
    const completedLines = group.lines.filter((line) => line.status === "COMPLETED");
    const pendingCreditGbp = roundMoney(
      pendingLines.reduce((sum, line) => sum + line.creditGbp, 0),
    );
    const completedCreditGbp = roundMoney(
      completedLines.reduce((sum, line) => sum + line.creditGbp, 0),
    );
    const statement = latestStatementByWorkspace.get(group.workspaceId) ?? null;
    const onlinePaidGbp = onlinePaidByWorkspace.get(group.workspaceId) ?? 0;
    const priorBilledGbp = priorBilledByWorkspace.get(group.workspaceId) ?? null;
    const statementPreviouslyPaidGbp = statement
      ? toNumber(statement.previouslyPaidGbpAmount)
      : 0;
    // Prefer live online payments; fall back to statement snapshot.
    const alreadyPaidGbp = onlinePaidGbp > 0 ? onlinePaidGbp : statementPreviouslyPaidGbp;

    let rollupStatus: "PENDING_OFFLINE" | "COMPLETED" | "MIXED" | "ZERO_NO_REFUND" =
      "ZERO_NO_REFUND";
    if (pendingLines.length > 0 && completedLines.length > 0) rollupStatus = "MIXED";
    else if (pendingLines.length > 0) rollupStatus = "PENDING_OFFLINE";
    else if (completedLines.length > 0) rollupStatus = "COMPLETED";
    else if (group.lines.some((line) => line.status === "ZERO_NO_REFUND")) {
      rollupStatus = "ZERO_NO_REFUND";
    }

    return {
      workspaceId: group.workspaceId,
      registrationNumber: group.registrationNumber,
      candidate: group.candidate,
      registrationWindow: group.registrationWindow,
      rollupStatus,
      pendingCount: pendingLines.length,
      completedCount: completedLines.length,
      pendingCreditGbp,
      completedCreditGbp,
      onlinePaidGbp,
      alreadyPaidGbp,
      priorBilledGbp,
      paymentSource:
        onlinePaidGbp > 0
          ? ("ONLINE" as const)
          : alreadyPaidGbp > 0
            ? ("STATEMENT_SNAPSHOT" as const)
            : pendingCreditGbp > 0
              ? ("NO_ONLINE_PAYMENT_RECORDED" as const)
              : ("NONE" as const),
      statement: statement
        ? {
            id: statement.id,
            statementNo: statement.statementNo,
            status: statement.status,
            totalGbp: toNumber(statement.totalGbpAmount),
            previouslyPaidGbp: statementPreviouslyPaidGbp,
            amountDueGbp:
              statement.amountDueGbpAmount == null
                ? toNumber(statement.totalGbpAmount)
                : toNumber(statement.amountDueGbpAmount),
            paymentNotes: statement.paymentNotes,
          }
        : null,
      lines: group.lines,
    };
  });

  groups.sort((a, b) => {
    const nameA = a.candidate?.englishName ?? "";
    const nameB = b.candidate?.englishName ?? "";
    return nameA.localeCompare(nameB);
  });

  return groups;
}

/** @deprecated unused helper kept for typing clarity */
export type _Tx = Tx;
