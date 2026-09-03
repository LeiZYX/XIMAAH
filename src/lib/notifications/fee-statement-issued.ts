import { formatMoney } from "@/lib/fees/money";
import { statementAmountDueGbp } from "@/lib/fees/payment-due";
import { prisma } from "@/lib/prisma";
import {
  boardSeriesLabel,
  renderFeeStatementIssuedEmail,
} from "@/lib/notifications/templates";
import {
  deliverStudentNotification,
  getAppUrl,
  queueStudentNotification,
  recordNotification,
  resolveStudentRecipient,
} from "@/lib/notifications/send";

function feeLineLabel(item: {
  subjectSnapshot: string | null;
  paperCodeSnapshot: string | null;
  paperTitleSnapshot: string | null;
  serviceNameSnapshot: string | null;
  entryTypeSnapshot: string | null;
}): string {
  const parts = [
    item.subjectSnapshot,
    item.paperCodeSnapshot
      ? `${item.paperCodeSnapshot}${item.paperTitleSnapshot ? ` ${item.paperTitleSnapshot}` : ""}`
      : item.paperTitleSnapshot,
    item.serviceNameSnapshot,
    item.entryTypeSnapshot && item.entryTypeSnapshot !== "NORMAL"
      ? `(${item.entryTypeSnapshot})`
      : null,
  ].filter(Boolean);
  return parts.join(" · ") || "Fee item";
}

function statementAmountDueCny(statement: {
  totalCnyAmount: { toString(): string } | number | string;
  amountDueCnyAmount?: { toString(): string } | number | string | null;
}): number {
  if (
    statement.amountDueCnyAmount !== undefined &&
    statement.amountDueCnyAmount !== null &&
    statement.amountDueCnyAmount !== ""
  ) {
    return Math.round(Number(statement.amountDueCnyAmount) * 100) / 100;
  }
  return Math.round(Number(statement.totalCnyAmount) * 100) / 100;
}

export async function notifyFeeStatementIssued(statementId: string): Promise<{
  delivered: boolean;
  skipped?: boolean;
  reason?: string;
}> {
  const statement = await prisma.feeStatement.findUnique({
    where: { id: statementId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      registrationWindow: {
        include: {
          examBoard: { select: { code: true, name: true } },
          examSeries: { select: { name: true, year: true } },
        },
      },
    },
  });

  if (!statement) {
    return { delivered: false, skipped: true, reason: "statement not found" };
  }

  if (statement.statementKind !== "NORMAL" || !statement.studentVisible) {
    return { delivered: false, skipped: true, reason: "not student-visible normal statement" };
  }

  if (statement.status !== "ISSUED" && statement.status !== "PAID") {
    return { delivered: false, skipped: true, reason: "statement not issued" };
  }

  const dedupeKey = `FEE_ISSUED:${statement.id}`;
  const recipient = await resolveStudentRecipient({
    studentUserId: statement.studentId,
    candidateId: statement.candidateId,
    emailSnapshot: statement.emailSnapshot,
    nameSnapshot: statement.studentNameSnapshot,
  });

  if (!recipient.email) {
    await recordNotification({
      type: "FEE_ISSUED",
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

  const totalGbp = Number(statement.totalGbpAmount);
  const totalCny = Number(statement.totalCnyAmount);
  const dueGbp = statementAmountDueGbp(statement);
  const dueCny = statementAmountDueCny(statement);

  const totalLabel =
    statement.displayCurrency === "CNY"
      ? formatMoney(totalCny, "CNY")
      : statement.displayCurrency === "BOTH"
        ? `${formatMoney(totalGbp, "GBP")} / ${formatMoney(totalCny, "CNY")}`
        : formatMoney(totalGbp, "GBP");

  const amountDueLabel =
    statement.displayCurrency === "CNY"
      ? formatMoney(dueCny, "CNY")
      : statement.displayCurrency === "BOTH"
        ? `${formatMoney(dueGbp, "GBP")} / ${formatMoney(dueCny, "CNY")}`
        : formatMoney(dueGbp, "GBP");

  const statusLabel =
    statement.status === "PAID"
      ? dueGbp <= 0
        ? "Paid / no payment due"
        : "Paid"
      : "Issued";

  const appUrl = await getAppUrl();
  const content = renderFeeStatementIssuedEmail({
    appUrl,
    studentName: recipient.name,
    boardSeries,
    statementNo: statement.statementNo,
    statusLabel,
    totalLabel,
    amountDueLabel,
    paymentNotes: statement.paymentNotes,
    lines: statement.items.map((item) => ({
      label: feeLineLabel(item),
      amountLabel:
        statement.displayCurrency === "CNY"
          ? formatMoney(Number(item.lineTotalCny), "CNY")
          : statement.displayCurrency === "BOTH"
            ? `${formatMoney(Number(item.lineTotalGbp), "GBP")} / ${formatMoney(Number(item.lineTotalCny), "CNY")}`
            : formatMoney(Number(item.lineTotalGbp), "GBP"),
    })),
  });

  return deliverStudentNotification({
    type: "FEE_ISSUED",
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
      status: statement.status,
      amountDueGbp: dueGbp,
    },
  });
}

export function queueFeeStatementIssuedNotification(statementId: string): void {
  queueStudentNotification(() => notifyFeeStatementIssued(statementId));
}
