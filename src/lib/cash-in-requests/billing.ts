import type { FeeCurrency, FeeStatementDisplayCurrency } from "@/generated/prisma/enums";
import { createFeeAuditLog } from "@/lib/fees/audit";
import { DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY } from "@/lib/fees/display-currency";
import { roundMoney, toNumber } from "@/lib/fees/money";
import { computeStatementPaymentSplit } from "@/lib/fees/payment-due";
import { prisma } from "@/lib/prisma";
import { logPostResultsAudit } from "@/lib/post-results/audit";
import { generatePostResultsFeeStatementNumber } from "@/lib/registrations/numbering";

export const CASH_IN_SERVICE_NAME = "Cash-in";

export function dualCurrencyFromQuotedSales(params: {
  salesAmount: number;
  salesCurrency: FeeCurrency | string;
  exchangeRateGbpToCny: number | null;
}): {
  salesGbp: number;
  salesCny: number;
  exchangeRateGbpToCny: number | null;
} {
  const salesAmount = roundMoney(params.salesAmount);
  const currency = params.salesCurrency;
  const rate =
    params.exchangeRateGbpToCny != null && params.exchangeRateGbpToCny > 0
      ? params.exchangeRateGbpToCny
      : null;

  if (currency === "GBP") {
    return {
      salesGbp: salesAmount,
      salesCny: rate ? roundMoney(salesAmount * rate) : salesAmount,
      exchangeRateGbpToCny: rate,
    };
  }

  if (currency === "CNY") {
    return {
      salesCny: salesAmount,
      salesGbp: rate ? roundMoney(salesAmount / rate) : salesAmount,
      exchangeRateGbpToCny: rate,
    };
  }

  throw new Error(`Unsupported sales currency: ${currency}`);
}

export function isCashInFeeStatementPayable(statement: {
  status: string;
  amountDueGbpAmount?: { toString(): string } | number | string | null;
  totalGbpAmount: { toString(): string } | number | string;
}): boolean {
  if (statement.status === "PAID") return true;
  if (statement.status !== "ISSUED") return false;
  const due =
    statement.amountDueGbpAmount != null && statement.amountDueGbpAmount !== ""
      ? toNumber(statement.amountDueGbpAmount)
      : toNumber(statement.totalGbpAmount);
  return due <= 0;
}

/**
 * Create and issue a student-visible POST_RESULTS fee statement for a submitted cash-in request.
 * Idempotent when feeStatementId is already set.
 */
export async function issueCashInFeeStatement(params: {
  cashInRequestId: string;
  performedByUserId: string;
  displayCurrency?: FeeStatementDisplayCurrency;
}) {
  const displayCurrency =
    params.displayCurrency ?? DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY;

  const request = await prisma.cashInRequest.findUnique({
    where: { id: params.cashInRequestId },
    include: {
      candidate: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              studentProfile: {
                select: {
                  currentGrade: true,
                  currentClassName: true,
                  email: true,
                  studentNo: true,
                },
              },
            },
          },
        },
      },
      examBoard: { select: { id: true, code: true, name: true } },
      examSeries: { select: { id: true, name: true, year: true } },
      qualification: { select: { name: true, level: true } },
      subject: { select: { name: true, code: true } },
      feeSchedule: true,
      feeStatement: {
        select: {
          id: true,
          statementNo: true,
          status: true,
          amountDueGbpAmount: true,
          totalGbpAmount: true,
        },
      },
    },
  });

  if (!request) throw new Error("Cash-in request not found");
  if (request.feeStatementId && request.feeStatement) {
    return request.feeStatement;
  }
  if (request.quotedSalesAmount == null || !request.quotedSalesCurrency) {
    throw new Error("A fee quote is required before generating a cash-in fee statement");
  }

  const quotedSalesCurrency = request.quotedSalesCurrency;
  const quotedSalesAmount = toNumber(request.quotedSalesAmount);
  const costCurrency = request.quotedCostCurrency ?? quotedSalesCurrency;

  const candidate = request.candidate;
  const scheduleRate = request.feeSchedule?.exchangeRateToCny
    ? toNumber(request.feeSchedule.exchangeRateToCny)
    : null;
  const amounts = dualCurrencyFromQuotedSales({
    salesAmount: quotedSalesAmount,
    salesCurrency: quotedSalesCurrency,
    exchangeRateGbpToCny: scheduleRate,
  });

  const paymentSplit = computeStatementPaymentSplit({
    totalGbp: amounts.salesGbp,
    totalCny: amounts.salesCny,
    previouslyPaidGbp: 0,
  });
  const noPaymentDue = paymentSplit.amountDueGbp <= 0;
  const initialStatus = noPaymentDue ? "PAID" : "ISSUED";
  const statementNo = await generatePostResultsFeeStatementNumber();

  const studentName =
    candidate.preferredEnglishName ||
    candidate.englishName ||
    candidate.user?.name ||
    "";
  const profile = candidate.user?.studentProfile;
  const studentNo =
    candidate.studentNumber ||
    profile?.studentNo ||
    candidate.assessmentHubCandidateNumber ||
    candidate.studentId ||
    "";
  const grade = candidate.grade ?? profile?.currentGrade ?? "";
  const className = candidate.className ?? profile?.currentClassName ?? "";
  const email = candidate.email ?? profile?.email ?? candidate.user?.email ?? null;

  const statement = await prisma.$transaction(async (tx) => {
    const created = await tx.feeStatement.create({
      data: {
        businessType: "POST_RESULTS",
        candidateId: request.candidateId,
        studentId: candidate.userId ?? null,
        registrationWorkspaceId: null,
        registrationWindowId: null,
        reviewWindowId: request.reviewWindowId,
        statementNo,
        statementKind: "NORMAL",
        studentVisible: true,
        displayCurrency,
        exchangeRateSnapshot: amounts.exchangeRateGbpToCny,
        studentNameSnapshot: studentName,
        studentNoSnapshot: studentNo,
        gradeSnapshot: String(grade ?? ""),
        classNameSnapshot: className,
        emailSnapshot: email,
        assessmentHubCandidateNumberSnapshot: candidate.assessmentHubCandidateNumber,
        candidateTypeSnapshot: candidate.candidateType,
        status: initialStatus,
        totalGbpAmount: paymentSplit.totalGbp,
        totalCnyAmount: paymentSplit.totalCny,
        previouslyPaidGbpAmount: paymentSplit.previouslyPaidGbp,
        previouslyPaidCnyAmount: paymentSplit.previouslyPaidCny,
        amountDueGbpAmount: paymentSplit.amountDueGbp,
        amountDueCnyAmount: paymentSplit.amountDueCny,
        paymentNotes: noPaymentDue ? "No payment due." : null,
        generatedByUserId: params.performedByUserId,
        issuedAt: new Date(),
        items: {
          create: [
            {
              serviceType: "CASH_IN",
              feeScheduleId: request.feeScheduleId,
              feeScheduleVersionSnapshot: request.feeSchedule?.version ?? null,
              serviceNameSnapshot: CASH_IN_SERVICE_NAME,
              examBoardSnapshot: request.examBoard.code,
              qualificationSnapshot: `${request.qualification.name} (${request.qualification.level})`,
              subjectSnapshot: request.subject.name,
              paperCodeSnapshot: request.cashInCode,
              paperTitleSnapshot: `Cash-in · ${request.subject.code}`,
              entryTypeSnapshot: null,
              costCurrencySnapshot: costCurrency,
              costAmountSnapshot:
                request.quotedCostAmount != null
                  ? toNumber(request.quotedCostAmount)
                  : quotedSalesAmount,
              exchangeRateSnapshot: amounts.exchangeRateGbpToCny,
              markupTypeSnapshot: request.feeSchedule?.markupType ?? null,
              markupValueSnapshot: request.feeSchedule?.markupValue
                ? toNumber(request.feeSchedule.markupValue)
                : null,
              salesCurrencySnapshot: quotedSalesCurrency,
              salesAmountSnapshot: quotedSalesAmount,
              salesGbpAmountSnapshot: amounts.salesGbp,
              salesCnyAmountSnapshot: amounts.salesCny,
              displayCurrencySnapshot: displayCurrency,
              lineTotalGbp: amounts.salesGbp,
              lineTotalCny: amounts.salesCny,
              quantity: 1,
            },
          ],
        },
      },
      select: {
        id: true,
        statementNo: true,
        status: true,
        amountDueGbpAmount: true,
        totalGbpAmount: true,
      },
    });

    await tx.cashInRequest.update({
      where: { id: request.id },
      data: { feeStatementId: created.id },
    });

    return created;
  });

  await createFeeAuditLog({
    action: "POST_RESULTS_FEE_STATEMENT_GENERATED",
    performedByUserId: params.performedByUserId,
    metadata: {
      cashInRequestId: request.id,
      feeStatementId: statement.id,
      statementNo: statement.statementNo,
      businessType: "POST_RESULTS",
      serviceType: "CASH_IN",
    },
  });

  await logPostResultsAudit({
    action: "POST_RESULTS_FEE_STATEMENT_GENERATED",
    performedByUserId: params.performedByUserId,
    candidateId: request.candidateId,
    examBoardId: request.examBoardId,
    examSeriesId: request.examSeriesId,
    reviewWindowId: request.reviewWindowId,
    serviceType: "CASH_IN",
    metadata: {
      cashInRequestId: request.id,
      feeStatementId: statement.id,
      statementNo: statement.statementNo,
    },
  });

  return statement;
}

export async function assertCashInPaidBeforeSentToBoard(cashInRequestId: string) {
  const request = await prisma.cashInRequest.findUnique({
    where: { id: cashInRequestId },
    include: {
      feeStatement: {
        select: {
          id: true,
          status: true,
          amountDueGbpAmount: true,
          totalGbpAmount: true,
          statementNo: true,
        },
      },
    },
  });

  if (!request) throw new Error("Cash-in request not found");
  if (!request.feeStatement) {
    throw new Error("Issue and collect the cash-in fee statement before sending to the board");
  }
  if (!isCashInFeeStatementPayable(request.feeStatement)) {
    throw new Error(
      `Fee statement ${request.feeStatement.statementNo} must be paid before sending to the board`,
    );
  }
}

export async function cancelUnpaidCashInFeeStatement(params: {
  cashInRequestId: string;
  performedByUserId?: string;
}) {
  void params.performedByUserId;
  const request = await prisma.cashInRequest.findUnique({
    where: { id: params.cashInRequestId },
    include: {
      feeStatement: {
        select: { id: true, status: true, statementNo: true },
      },
    },
  });
  if (!request?.feeStatement) return null;
  if (request.feeStatement.status !== "ISSUED") return request.feeStatement;

  return prisma.feeStatement.update({
    where: { id: request.feeStatement.id },
    data: { status: "CANCELLED" },
    select: { id: true, status: true, statementNo: true },
  });
}
