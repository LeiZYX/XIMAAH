import type { FeeRefundMethod, FeeRefundReason } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { FeeError } from "@/lib/fees/statement";
import { recordFeeStatementEvent } from "@/lib/fees/statement-events";
import type { FeeRefundDisplayStatus } from "@/lib/fees/refund-labels";
import { roundMoney, toNumber } from "@/lib/fees/money";
import { prisma } from "@/lib/prisma";

export type FeeRefundAllocationInput = {
  offlineWithdrawalRefundId: string;
  amountGbp: number;
};

export type RecordFeeRefundInput = {
  statementId: string;
  performedByUserId: string;
  method: FeeRefundMethod;
  paymentOrderId?: string | null;
  amountGbp: number;
  refundedAt: Date;
  externalReference: string;
  reason: FeeRefundReason;
  note?: string | null;
  allocations?: FeeRefundAllocationInput[];
};

type Summary = {
  refundDueGbp: number;
  refundStatus: FeeRefundDisplayStatus;
  refundableGbp: number;
};

function cents(value: number): number {
  return Math.round(roundMoney(value) * 100);
}

function channelLabel(channel: string | null | undefined): string {
  if (channel === "Wechat") return "WeChat";
  if (channel === "Alipay") return "Alipay";
  return channel?.trim() || "";
}

function offlineCollectedGbp(statement: {
  totalGbpAmount: { toString(): string } | number | string;
  previouslyPaidGbpAmount?: { toString(): string } | number | string | null;
}): number {
  const total = toNumber(statement.totalGbpAmount);
  const previously =
    statement.previouslyPaidGbpAmount == null ? 0 : toNumber(statement.previouslyPaidGbpAmount);
  return roundMoney(Math.max(0, total - previously));
}

export async function refundSummariesByWorkspace(workspaceIds: string[]) {
  const ids = [...new Set(workspaceIds.filter(Boolean))];
  const map = new Map<string, Summary>();
  for (const id of ids) {
    map.set(id, { refundDueGbp: 0, refundStatus: "NONE", refundableGbp: 0 });
  }
  if (ids.length === 0) return map;

  const [lines, refunds, orders, offlineStatements] = await Promise.all([
    prisma.offlineWithdrawalRefund.findMany({
      where: {
        registrationWorkspaceId: { in: ids },
        status: { in: ["PENDING_OFFLINE", "COMPLETED"] },
      },
      select: {
        registrationWorkspaceId: true,
        status: true,
        creditGbp: true,
        allocations: { select: { amountGbp: true } },
      },
    }),
    prisma.feeRefund.findMany({
      where: { registrationWorkspaceId: { in: ids } },
      select: { registrationWorkspaceId: true, amountGbp: true },
    }),
    prisma.paymentOrder.findMany({
      where: {
        status: "PAID",
        feeStatement: { registrationWorkspaceId: { in: ids } },
      },
      select: {
        amountGbp: true,
        feeStatement: { select: { registrationWorkspaceId: true } },
      },
    }),
    prisma.feeStatement.findMany({
      where: {
        registrationWorkspaceId: { in: ids },
        paymentSettlement: "OFFLINE",
      },
      select: {
        registrationWorkspaceId: true,
        totalGbpAmount: true,
        previouslyPaidGbpAmount: true,
      },
    }),
  ]);

  const collected = new Map<string, number>();
  const refunded = new Map<string, number>();
  const due = new Map<string, number>();
  const allocated = new Map<string, number>();
  const hadCredit = new Set<string>();

  for (const order of orders) {
    const workspaceId = order.feeStatement.registrationWorkspaceId;
    if (!workspaceId) continue;
    collected.set(
      workspaceId,
      roundMoney((collected.get(workspaceId) ?? 0) + toNumber(order.amountGbp)),
    );
  }
  for (const statement of offlineStatements) {
    const workspaceId = statement.registrationWorkspaceId;
    if (!workspaceId) continue;
    collected.set(
      workspaceId,
      roundMoney((collected.get(workspaceId) ?? 0) + offlineCollectedGbp(statement)),
    );
  }
  for (const refund of refunds) {
    refunded.set(
      refund.registrationWorkspaceId,
      roundMoney((refunded.get(refund.registrationWorkspaceId) ?? 0) + toNumber(refund.amountGbp)),
    );
  }
  for (const line of lines) {
    const credit = toNumber(line.creditGbp);
    if (credit <= 0) continue;
    const workspaceId = line.registrationWorkspaceId;
    hadCredit.add(workspaceId);
    const lineAllocated = roundMoney(
      line.allocations.reduce((sum, row) => sum + toNumber(row.amountGbp), 0),
    );
    allocated.set(workspaceId, roundMoney((allocated.get(workspaceId) ?? 0) + lineAllocated));
    if (line.status === "PENDING_OFFLINE") {
      due.set(
        workspaceId,
        roundMoney((due.get(workspaceId) ?? 0) + Math.max(0, credit - lineAllocated)),
      );
    }
  }

  for (const id of ids) {
    const refundDueGbp = due.get(id) ?? 0;
    const allocatedGbp = allocated.get(id) ?? 0;
    let refundStatus: FeeRefundDisplayStatus = "NONE";
    if (hadCredit.has(id)) {
      if (refundDueGbp <= 0.004) refundStatus = "SETTLED";
      else if (allocatedGbp <= 0.004) refundStatus = "PENDING";
      else refundStatus = "PARTIAL";
    }
    map.set(id, {
      refundDueGbp,
      refundStatus,
      refundableGbp: roundMoney(Math.max(0, (collected.get(id) ?? 0) - (refunded.get(id) ?? 0))),
    });
  }
  return map;
}

export async function attachRefundSummaries<
  T extends { registrationWorkspaceId?: string | null },
>(statements: T[]) {
  const summaries = await refundSummariesByWorkspace(
    statements
      .map((row) => row.registrationWorkspaceId)
      .filter((id): id is string => Boolean(id)),
  );
  return statements.map((row) => {
    const summary = row.registrationWorkspaceId
      ? summaries.get(row.registrationWorkspaceId)
      : undefined;
    return {
      ...row,
      refundDueGbp: summary?.refundDueGbp ?? 0,
      refundStatus: summary?.refundStatus ?? "NONE",
      refundableGbp: summary?.refundableGbp ?? 0,
    };
  });
}

type FeeDb = Prisma.TransactionClient | typeof prisma;

async function loadWorkspaceMoney(db: FeeDb, workspaceId: string) {
  const [orders, refunds, offlineStatements, pendingLines] = await Promise.all([
    db.paymentOrder.findMany({
      where: { status: "PAID", feeStatement: { registrationWorkspaceId: workspaceId } },
      select: {
        id: true,
        partnerOrderId: true,
        channel: true,
        amountGbp: true,
        paidAt: true,
        feeStatement: { select: { statementNo: true } },
      },
      orderBy: { paidAt: "desc" },
    }),
    db.feeRefund.findMany({
      where: { registrationWorkspaceId: workspaceId },
      select: { amountGbp: true, paymentOrderId: true },
    }),
    db.feeStatement.findMany({
      where: { registrationWorkspaceId: workspaceId, paymentSettlement: "OFFLINE" },
      select: { totalGbpAmount: true, previouslyPaidGbpAmount: true },
    }),
    db.offlineWithdrawalRefund.findMany({
      where: { registrationWorkspaceId: workspaceId, status: "PENDING_OFFLINE" },
      select: {
        id: true,
        paperCodeSnapshot: true,
        subjectSnapshot: true,
        creditGbp: true,
        createdAt: true,
        allocations: { select: { amountGbp: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const refundedByOrder = new Map<string, number>();
  let refundedGbp = 0;
  for (const refund of refunds) {
    refundedGbp = roundMoney(refundedGbp + toNumber(refund.amountGbp));
    if (!refund.paymentOrderId) continue;
    refundedByOrder.set(
      refund.paymentOrderId,
      roundMoney((refundedByOrder.get(refund.paymentOrderId) ?? 0) + toNumber(refund.amountGbp)),
    );
  }

  const onlineCollected = roundMoney(
    orders.reduce((sum, order) => sum + toNumber(order.amountGbp), 0),
  );
  const offlineCollected = roundMoney(
    offlineStatements.reduce((sum, statement) => sum + offlineCollectedGbp(statement), 0),
  );
  const collectedGbp = roundMoney(onlineCollected + offlineCollected);
  const refundableGbp = roundMoney(Math.max(0, collectedGbp - refundedGbp));

  const orderRows = orders.map((order) => {
    const amountGbp = toNumber(order.amountGbp);
    const refunded = refundedByOrder.get(order.id) ?? 0;
    return {
      id: order.id,
      partnerOrderId: order.partnerOrderId,
      channel: order.channel,
      statementNo: order.feeStatement.statementNo,
      amountGbp,
      refundedGbp: refunded,
      remainingGbp: roundMoney(Math.max(0, amountGbp - refunded)),
      paidAt: order.paidAt?.toISOString() ?? null,
    };
  });

  const pending = pendingLines
    .map((line) => {
      const creditGbp = toNumber(line.creditGbp);
      const allocatedGbp = roundMoney(
        line.allocations.reduce((sum, row) => sum + toNumber(row.amountGbp), 0),
      );
      return {
        id: line.id,
        paperCode: line.paperCodeSnapshot,
        subject: line.subjectSnapshot,
        creditGbp,
        allocatedGbp,
        remainingGbp: roundMoney(Math.max(0, creditGbp - allocatedGbp)),
      };
    })
    .filter((line) => line.remainingGbp > 0.004);

  return {
    collectedGbp,
    refundedGbp,
    refundableGbp,
    orders: orderRows,
    pendingLines: pending,
  };
}

export async function getFeeRefundContext(statementId: string) {
  const statement = await prisma.feeStatement.findUnique({
    where: { id: statementId },
    select: {
      id: true,
      statementNo: true,
      registrationWorkspaceId: true,
    },
  });
  if (!statement) throw new FeeError("Fee statement not found");
  if (!statement.registrationWorkspaceId) {
    throw new FeeError("This statement is not linked to a registration");
  }
  const money = await loadWorkspaceMoney(prisma, statement.registrationWorkspaceId);
  const summaries = await refundSummariesByWorkspace([statement.registrationWorkspaceId]);
  const summary = summaries.get(statement.registrationWorkspaceId);
  return {
    statementId: statement.id,
    statementNo: statement.statementNo,
    collectedGbp: money.collectedGbp,
    alreadyRefundedGbp: money.refundedGbp,
    refundableGbp: money.refundableGbp,
    refundDueGbp: summary?.refundDueGbp ?? 0,
    refundStatus: summary?.refundStatus ?? "NONE",
    orders: money.orders,
    pendingLines: money.pendingLines,
  };
}

function resolveAllocations(params: {
  reason: FeeRefundReason;
  amountGbp: number;
  provided: FeeRefundAllocationInput[] | undefined;
  pendingLines: Array<{ id: string; remainingGbp: number }>;
}): FeeRefundAllocationInput[] {
  if (params.reason !== "WITHDRAWAL") {
    if (params.provided && params.provided.length > 0) {
      throw new FeeError("Only withdrawal refunds can be allocated to withdrawn exams");
    }
    return [];
  }

  const remaining = new Map(params.pendingLines.map((line) => [line.id, line.remainingGbp]));
  const amountCents = cents(params.amountGbp);

  if (!params.provided || params.provided.length === 0) {
    const allocations: FeeRefundAllocationInput[] = [];
    let left = amountCents;
    for (const line of params.pendingLines) {
      if (left <= 0) break;
      const lineCents = cents(line.remainingGbp);
      if (lineCents <= 0) continue;
      const take = Math.min(left, lineCents);
      allocations.push({
        offlineWithdrawalRefundId: line.id,
        amountGbp: roundMoney(take / 100),
      });
      left -= take;
    }
    if (left > 0) {
      throw new FeeError("Refund amount is higher than the remaining withdrawal credit");
    }
    if (allocations.length === 0) {
      throw new FeeError("No withdrawal credit left to allocate");
    }
    return allocations;
  }

  const seen = new Set<string>();
  let sum = 0;
  const allocations: FeeRefundAllocationInput[] = [];
  for (const row of params.provided) {
    if (seen.has(row.offlineWithdrawalRefundId)) {
      throw new FeeError("Each withdrawn exam can only be allocated once");
    }
    seen.add(row.offlineWithdrawalRefundId);
    const lineRemaining = remaining.get(row.offlineWithdrawalRefundId);
    if (lineRemaining == null) {
      throw new FeeError("Allocation does not match a pending withdrawal on this registration");
    }
    const rowCents = cents(row.amountGbp);
    if (rowCents <= 0) throw new FeeError("Allocation amount must be greater than zero");
    if (rowCents > cents(lineRemaining)) {
      throw new FeeError("Allocation is higher than the remaining credit on that exam");
    }
    sum += rowCents;
    allocations.push({
      offlineWithdrawalRefundId: row.offlineWithdrawalRefundId,
      amountGbp: roundMoney(rowCents / 100),
    });
  }
  if (sum !== amountCents) {
    throw new FeeError("Withdrawal allocations must add up to the refund amount");
  }
  return allocations;
}

export async function recordFeeRefund(input: RecordFeeRefundInput) {
  const externalReference = input.externalReference.trim();
  const note = input.note?.trim() || null;
  const amountGbp = roundMoney(input.amountGbp);
  if (!Number.isFinite(amountGbp) || cents(amountGbp) <= 0) {
    throw new FeeError("Refund amount must be greater than zero");
  }
  if (!externalReference) throw new FeeError("External reference is required");
  if (externalReference.length > 191) throw new FeeError("External reference is too long");
  if (Number.isNaN(input.refundedAt.getTime())) throw new FeeError("Refund date is invalid");
  if (input.reason === "OTHER" && !note) throw new FeeError("A note is required when the reason is Other");
  if (input.method !== "ORIGINAL_CHANNEL" && input.method !== "OFFLINE") {
    throw new FeeError("Refund method is invalid");
  }
  if (input.method === "ORIGINAL_CHANNEL" && !input.paymentOrderId) {
    throw new FeeError("Choose the paid order to refund against");
  }

  const statement = await prisma.feeStatement.findUnique({
    where: { id: input.statementId },
    select: {
      id: true,
      statementNo: true,
      registrationWorkspaceId: true,
      registrationWindowId: true,
    },
  });
  if (!statement) throw new FeeError("Fee statement not found");
  if (!statement.registrationWorkspaceId) {
    throw new FeeError("This statement is not linked to a registration");
  }
  const workspaceId = statement.registrationWorkspaceId;

  return prisma.$transaction(async (tx) => {
    const money = await loadWorkspaceMoney(tx, workspaceId);
    if (cents(amountGbp) > cents(money.refundableGbp)) {
      throw new FeeError(
        `Refund is higher than the remaining refundable amount (£${money.refundableGbp.toFixed(2)})`,
      );
    }

    let channel: string | null = null;
    let paymentOrderId: string | null = null;
    if (input.method === "ORIGINAL_CHANNEL") {
      const order = money.orders.find((row) => row.id === input.paymentOrderId);
      if (!order) throw new FeeError("Paid order was not found on this registration");
      if (cents(amountGbp) > cents(order.remainingGbp)) {
        throw new FeeError(
          `Refund is higher than the remaining amount on that order (£${order.remainingGbp.toFixed(2)})`,
        );
      }
      paymentOrderId = order.id;
      channel = order.channel;
    }

    const allocations = resolveAllocations({
      reason: input.reason,
      amountGbp,
      provided: input.allocations,
      pendingLines: money.pendingLines,
    });

    const created = await tx.feeRefund.create({
      data: {
        feeStatementId: statement.id,
        registrationWorkspaceId: workspaceId,
        registrationWindowId: statement.registrationWindowId,
        method: input.method,
        paymentOrderId,
        amountGbp,
        refundedAt: input.refundedAt,
        externalReference,
        reason: input.reason,
        note,
        recordedByUserId: input.performedByUserId,
        allocations: {
          create: allocations.map((row) => ({
            offlineWithdrawalRefundId: row.offlineWithdrawalRefundId,
            amountGbp: row.amountGbp,
          })),
        },
      },
    });
    const refundId = created.id;

    if (allocations.length > 0) {
      const lines = await tx.offlineWithdrawalRefund.findMany({
        where: { id: { in: allocations.map((row) => row.offlineWithdrawalRefundId) } },
        select: {
          id: true,
          creditGbp: true,
          allocations: { select: { amountGbp: true } },
        },
      });
      for (const line of lines) {
        const allocated = roundMoney(
          line.allocations.reduce((sum, row) => sum + toNumber(row.amountGbp), 0),
        );
        if (cents(allocated) + 1 < cents(toNumber(line.creditGbp))) continue;
        await tx.offlineWithdrawalRefund.update({
          where: { id: line.id },
          data: {
            status: "COMPLETED",
            completedAt: input.refundedAt,
            completedByUserId: input.performedByUserId,
            offlineReference: externalReference,
            offlineNote: note,
          },
        });
      }
    }

    const channelText = channelLabel(channel);
    const summary =
      input.method === "ORIGINAL_CHANNEL"
        ? `Refund recorded · Original channel · £${amountGbp.toFixed(2)}${channelText ? ` · ${channelText}` : ""} · ${externalReference}`
        : `Refund recorded · Offline · £${amountGbp.toFixed(2)} · ${externalReference}`;

    await recordFeeStatementEvent(tx, {
      feeStatementId: statement.id,
      paymentOrderId,
      kind: "REFUND_RECORDED",
      occurredAt: input.refundedAt,
      actorUserId: input.performedByUserId,
      summary,
    });
    await tx.feeAuditLog.create({
      data: {
        action: "FEE_REFUND_RECORDED",
        performedByUserId: input.performedByUserId,
        registrationWindowId: statement.registrationWindowId,
        note: summary,
        metadata: JSON.stringify({
          feeRefundId: refundId,
          feeStatementId: statement.id,
          statementNo: statement.statementNo,
          method: input.method,
          paymentOrderId,
          amountGbp,
          reason: input.reason,
          externalReference,
          allocationCount: allocations.length,
        }),
      },
    });

    return { id: refundId, summary };
  });
}
