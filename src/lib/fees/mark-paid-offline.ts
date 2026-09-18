import { createFeeAuditLog } from "@/lib/fees/audit";
import { FeeError } from "@/lib/fees/statement";
import { offlineSettlement } from "@/lib/fees/payment-settlement";
import { prisma } from "@/lib/prisma";

export async function markFeeStatementPaidOffline(params: {
  statementId: string;
  performedByUserId: string;
  note?: string | null;
  /** e.g. FEE_STATEMENTS_BATCH | CASH_IN */
  source?: string;
}) {
  const statement = await prisma.feeStatement.findUnique({
    where: { id: params.statementId },
    select: {
      id: true,
      statementNo: true,
      status: true,
      paymentSettlement: true,
      paymentNotes: true,
      registrationWindowId: true,
      registrationWorkspaceId: true,
      studentNameSnapshot: true,
    },
  });

  if (!statement) {
    throw new FeeError("Fee statement not found");
  }

  if (statement.status === "PAID") {
    return {
      statementId: statement.id,
      statementNo: statement.statementNo,
      alreadyPaid: true as const,
      paymentSettlement: statement.paymentSettlement,
    };
  }

  if (statement.status !== "ISSUED") {
    throw new FeeError(
      `Cannot mark fee statement ${statement.statementNo} as paid (status: ${statement.status}). Only Issued statements can be marked paid offline.`,
    );
  }

  const noteText =
    params.note?.trim() ||
    "Marked paid offline (payment received outside WeChat/Alipay QR).";
  const paymentNote = `Offline payment recorded by staff. ${noteText}`;
  const settlement = offlineSettlement();

  await prisma.$transaction(async (tx) => {
    await tx.feeStatement.update({
      where: { id: statement.id },
      data: {
        status: "PAID",
        paymentSettlement: settlement,
        amountDueGbpAmount: 0,
        amountDueCnyAmount: 0,
        paymentNotes: statement.paymentNotes
          ? `${statement.paymentNotes}\n${paymentNote}`
          : paymentNote,
      },
    });

    await tx.paymentOrder.updateMany({
      where: {
        feeStatementId: statement.id,
        status: { in: ["CREATED", "PAYING"] },
      },
      data: { status: "CLOSED" },
    });
  });

  await createFeeAuditLog({
    action: "FEE_STATEMENT_MARKED_PAID_OFFLINE",
    performedByUserId: params.performedByUserId,
    registrationWindowId: statement.registrationWindowId,
    note: paymentNote,
    metadata: {
      feeStatementId: statement.id,
      statementNo: statement.statementNo,
      workspaceId: statement.registrationWorkspaceId,
      method: "OFFLINE",
      settlement,
      source: params.source ?? "FEE_STATEMENT",
      studentName: statement.studentNameSnapshot,
    },
  });

  return {
    statementId: statement.id,
    statementNo: statement.statementNo,
    alreadyPaid: false as const,
    paymentSettlement: settlement,
  };
}
