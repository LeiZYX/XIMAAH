import { formatMoney } from "@/lib/fees/money";
import { statementAmountDueGbp } from "@/lib/fees/payment-due";
import { prisma } from "@/lib/prisma";
import {
  boardSeriesLabel,
  renderFeeStatementPaidEmail,
} from "@/lib/notifications/templates";
import {
  deliverStudentNotification,
  getAppUrl,
  queueStudentNotification,
  recordNotification,
  resolveStudentRecipient,
} from "@/lib/notifications/send";
import { isStudentNotificationEnabled } from "@/lib/notifications/policy";

export async function notifyFeeStatementPaid(statementId: string): Promise<{
  delivered: boolean;
  skipped?: boolean;
  reason?: string;
}> {
  const policy = await isStudentNotificationEnabled("FEE_PAID");
  if (!policy.enabled) {
    return { delivered: false, skipped: true, reason: policy.reason };
  }

  const statement = await prisma.feeStatement.findUnique({
    where: { id: statementId },
    include: {
      registrationWindow: {
        include: {
          examBoard: { select: { code: true, name: true } },
          examSeries: { select: { name: true, year: true } },
        },
      },
      paymentOrders: {
        where: { status: "PAID" },
        orderBy: { paidAt: "desc" },
        take: 1,
        select: { amountGbp: true, paidAt: true, channel: true },
      },
    },
  });

  if (!statement) {
    return { delivered: false, skipped: true, reason: "statement not found" };
  }

  if (statement.statementKind !== "NORMAL" || !statement.studentVisible) {
    return { delivered: false, skipped: true, reason: "not student-visible normal statement" };
  }

  if (statement.status !== "PAID") {
    return { delivered: false, skipped: true, reason: "statement not paid" };
  }

  const dedupeKey = `FEE_PAID:${statement.id}`;
  const recipient = await resolveStudentRecipient({
    studentUserId: statement.studentId,
    candidateId: statement.candidateId,
    emailSnapshot: statement.emailSnapshot,
    nameSnapshot: statement.studentNameSnapshot,
  });

  if (!recipient.email) {
    await recordNotification({
      type: "FEE_PAID",
      status: "SKIPPED",
      dedupeKey,
      studentUserId: recipient.studentUserId,
      feeStatementId: statement.id,
      registrationWindowId: statement.registrationWindowId,
      error: "No student email address",
      metadata: { statementNo: statement.statementNo },
    });
    return { delivered: false, skipped: true, reason: "No student email address" };
  }

  const window = statement.registrationWindow;
  const boardSeries = window
    ? boardSeriesLabel({
        boardCode: window.examBoard.code,
        boardName: window.examBoard.name,
        seriesName: window.examSeries.name,
        seriesYear: window.examSeries.year,
      })
    : "Exam registration";

  const paidOrder = statement.paymentOrders[0];
  const amountPaid =
    paidOrder != null
      ? Number(paidOrder.amountGbp)
      : statementAmountDueGbp({
          totalGbpAmount: statement.totalGbpAmount,
          amountDueGbpAmount: statement.amountDueGbpAmount,
        }) || Number(statement.totalGbpAmount);

  const paidAtLabel = paidOrder?.paidAt
    ? paidOrder.paidAt.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : statement.issuedAt
      ? statement.issuedAt.toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  const appUrl = await getAppUrl();
  const content = renderFeeStatementPaidEmail({
    appUrl,
    studentName: recipient.name,
    boardSeries,
    statementNo: statement.statementNo,
    amountPaidLabel: formatMoney(amountPaid, "GBP"),
    paidAtLabel,
  });

  return deliverStudentNotification({
    type: "FEE_PAID",
    dedupeKey,
    to: recipient.email,
    subject: content.subject,
    text: content.text,
    html: content.html,
    studentUserId: recipient.studentUserId,
    registrationWindowId: statement.registrationWindowId,
    feeStatementId: statement.id,
    metadata: {
      statementNo: statement.statementNo,
      amountPaidGbp: amountPaid,
      channel: paidOrder?.channel ?? null,
    },
  });
}

export function queueFeeStatementPaidNotification(statementId: string): void {
  queueStudentNotification(() => notifyFeeStatementPaid(statementId));
}
