import type { PostResultRequestStatus } from "@/generated/prisma/client";
import {
  assertCashInPaidBeforeSentToBoard,
  cancelUnpaidCashInFeeStatement,
  issueCashInFeeStatement,
  markCashInFeePaidOffline,
} from "@/lib/cash-in-requests/billing";
import { resolveCashInFee } from "@/lib/fees/cash-in-fee";
import { toNumber } from "@/lib/fees/money";
import { prisma } from "@/lib/prisma";
import { logPostResultsAudit } from "@/lib/post-results/audit";
import {
  canCancelCashInRequest,
  canTransitionCashInRequestStatus,
} from "@/lib/cash-in-requests/status";

export const cashInRequestInclude = {
  candidate: {
    select: {
      id: true,
      englishName: true,
      preferredEnglishName: true,
      assessmentHubCandidateNumber: true,
      studentNumber: true,
    },
  },
  examBoard: { select: { id: true, name: true, code: true } },
  examSeries: { select: { id: true, name: true, year: true } },
  qualification: { select: { id: true, name: true, level: true, code: true } },
  subject: { select: { id: true, name: true, code: true } },
  feeSchedule: {
    select: {
      id: true,
      version: true,
      salesAmount: true,
      salesCurrency: true,
    },
  },
  feeStatement: {
    select: {
      id: true,
      statementNo: true,
      status: true,
      totalGbpAmount: true,
      amountDueGbpAmount: true,
      issuedAt: true,
    },
  },
  requestedBy: { select: { id: true, name: true } },
} as const;

export async function listCashInRequests(filters: {
  examBoardId?: string;
  examSeriesId?: string;
  status?: PostResultRequestStatus | string;
  candidateId?: string;
  q?: string;
}) {
  const query = filters.q?.trim();
  return prisma.cashInRequest.findMany({
    where: {
      examBoardId: filters.examBoardId || undefined,
      examSeriesId: filters.examSeriesId || undefined,
      status: (filters.status as PostResultRequestStatus | undefined) || undefined,
      candidateId: filters.candidateId || undefined,
      ...(query
        ? {
            OR: [
              { cashInCode: { contains: query } },
              { candidate: { englishName: { contains: query } } },
              { candidate: { preferredEnglishName: { contains: query } } },
              { candidate: { assessmentHubCandidateNumber: { contains: query } } },
              { candidate: { studentNumber: { contains: query } } },
              { subject: { code: { contains: query } } },
              { subject: { name: { contains: query } } },
            ],
          }
        : {}),
    },
    include: cashInRequestInclude,
    orderBy: [{ createdAt: "desc" }],
    take: 500,
  });
}

export async function createCashInRequest(input: {
  candidateId: string;
  examBoardId: string;
  examSeriesId: string;
  qualificationId: string;
  subjectId: string;
  requestedByUserId: string;
  reason?: string | null;
  notes?: string | null;
  status?: "DRAFT" | "SUBMITTED";
}) {
  const [candidate, series, cashInCode, subject] = await Promise.all([
    prisma.candidate.findUnique({ where: { id: input.candidateId }, select: { id: true } }),
    prisma.examSeries.findFirst({
      where: { id: input.examSeriesId, examBoardId: input.examBoardId },
      select: { id: true },
    }),
    prisma.cashInCode.findFirst({
      where: {
        examBoardId: input.examBoardId,
        qualificationId: input.qualificationId,
        subjectId: input.subjectId,
        active: true,
      },
    }),
    prisma.subject.findUnique({
      where: { id: input.subjectId },
      select: {
        id: true,
        qualificationId: true,
        qualification: { select: { examBoardId: true } },
      },
    }),
  ]);

  if (!candidate) throw new Error("Candidate not found");
  if (!series) throw new Error("Exam series not found for this exam board");
  if (!subject) throw new Error("Subject not found");
  if (subject.qualificationId !== input.qualificationId) {
    throw new Error("Subject does not belong to the selected qualification");
  }
  if (subject.qualification.examBoardId !== input.examBoardId) {
    throw new Error("Subject does not belong to the selected exam board");
  }
  if (!cashInCode) {
    throw new Error(
      "No active cash-in code configured for this board, qualification, and subject",
    );
  }

  const status = input.status ?? "DRAFT";
  const quote = await resolveCashInFee({
    examBoardId: input.examBoardId,
    examSeriesId: input.examSeriesId,
    qualificationId: input.qualificationId,
    subjectId: input.subjectId,
  });

  if (status === "SUBMITTED" && !quote) {
    throw new Error("A fee schedule price is required before submitting a cash-in request");
  }

  const created = await prisma.cashInRequest.create({
    data: {
      candidateId: input.candidateId,
      examBoardId: input.examBoardId,
      examSeriesId: input.examSeriesId,
      qualificationId: input.qualificationId,
      subjectId: input.subjectId,
      cashInCode: cashInCode.cashInCode,
      feeScheduleId: quote?.schedule.id ?? null,
      quoteMatchLevel: quote?.matchLevel ?? null,
      quotedCostCurrency: quote?.schedule.costCurrency ?? null,
      quotedCostAmount: quote ? toNumber(quote.schedule.costAmount) : null,
      quotedSalesCurrency: quote?.schedule.salesCurrency ?? null,
      quotedSalesAmount: quote ? toNumber(quote.schedule.salesAmount) : null,
      status,
      requestedByUserId: input.requestedByUserId,
      reason: input.reason?.trim() || null,
      notes: input.notes?.trim() || null,
    },
    include: cashInRequestInclude,
  });

  await logPostResultsAudit({
    action: "CASH_IN_REQUEST_CREATED",
    performedByUserId: input.requestedByUserId,
    candidateId: input.candidateId,
    examBoardId: input.examBoardId,
    examSeriesId: input.examSeriesId,
    serviceType: "CASH_IN",
    metadata: {
      cashInRequestId: created.id,
      cashInCode: created.cashInCode,
      status: created.status,
      quoteMatchLevel: created.quoteMatchLevel,
    },
  });

  if (created.status === "SUBMITTED") {
    await issueCashInFeeStatement({
      cashInRequestId: created.id,
      performedByUserId: input.requestedByUserId,
    });
    return prisma.cashInRequest.findUniqueOrThrow({
      where: { id: created.id },
      include: cashInRequestInclude,
    });
  }

  return created;
}

export async function updateCashInRequestStatus(input: {
  id: string;
  status: PostResultRequestStatus | string;
  performedByUserId: string;
  notes?: string | null;
}) {
  const existing = await prisma.cashInRequest.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("Cash-in request not found");

  if (!canTransitionCashInRequestStatus(existing.status, input.status)) {
    throw new Error(`Cannot change status from ${existing.status} to ${input.status}`);
  }

  if (input.status === "CANCELLED" && !canCancelCashInRequest(existing.status)) {
    throw new Error("Cash-in requests cannot be cancelled after they are sent to the board");
  }

  if (input.status === "SENT_TO_BOARD") {
    await assertCashInPaidBeforeSentToBoard(input.id);
  }

  if (input.status === "SUBMITTED" && existing.quotedSalesAmount == null) {
    const quote = await resolveCashInFee({
      examBoardId: existing.examBoardId,
      examSeriesId: existing.examSeriesId,
      qualificationId: existing.qualificationId,
      subjectId: existing.subjectId,
    });
    if (!quote) {
      throw new Error("A fee schedule price is required before submitting a cash-in request");
    }

    const updated = await prisma.cashInRequest.update({
      where: { id: input.id },
      data: {
        status: "SUBMITTED",
        feeScheduleId: quote.schedule.id,
        quoteMatchLevel: quote.matchLevel,
        quotedCostCurrency: quote.schedule.costCurrency,
        quotedCostAmount: toNumber(quote.schedule.costAmount),
        quotedSalesCurrency: quote.schedule.salesCurrency,
        quotedSalesAmount: toNumber(quote.schedule.salesAmount),
        notes: input.notes !== undefined ? input.notes?.trim() || null : undefined,
      },
      include: cashInRequestInclude,
    });

    await logPostResultsAudit({
      action: "CASH_IN_REQUEST_UPDATED",
      performedByUserId: input.performedByUserId,
      candidateId: existing.candidateId,
      examBoardId: existing.examBoardId,
      examSeriesId: existing.examSeriesId,
      serviceType: "CASH_IN",
      metadata: {
        cashInRequestId: updated.id,
        fromStatus: existing.status,
        toStatus: updated.status,
        action: "SUBMIT",
      },
    });

    await issueCashInFeeStatement({
      cashInRequestId: updated.id,
      performedByUserId: input.performedByUserId,
    });

    return prisma.cashInRequest.findUniqueOrThrow({
      where: { id: updated.id },
      include: cashInRequestInclude,
    });
  }

  const updated = await prisma.cashInRequest.update({
    where: { id: input.id },
    data: {
      status: input.status as PostResultRequestStatus,
      notes: input.notes !== undefined ? input.notes?.trim() || null : undefined,
    },
    include: cashInRequestInclude,
  });

  await logPostResultsAudit({
    action: "CASH_IN_REQUEST_UPDATED",
    performedByUserId: input.performedByUserId,
    candidateId: existing.candidateId,
    examBoardId: existing.examBoardId,
    examSeriesId: existing.examSeriesId,
    serviceType: "CASH_IN",
    metadata: {
      cashInRequestId: updated.id,
      fromStatus: existing.status,
      toStatus: updated.status,
      action:
        updated.status === "CANCELLED"
          ? "CANCEL"
          : updated.status === "SENT_TO_BOARD"
            ? "SENT_TO_BOARD"
            : updated.status === "SUBMITTED"
              ? "SUBMIT"
              : updated.status === "COMPLETED"
                ? "COMPLETE"
                : "STATUS_CHANGE",
    },
  });

  if (updated.status === "SUBMITTED" && !updated.feeStatementId) {
    await issueCashInFeeStatement({
      cashInRequestId: updated.id,
      performedByUserId: input.performedByUserId,
    });
    return prisma.cashInRequest.findUniqueOrThrow({
      where: { id: updated.id },
      include: cashInRequestInclude,
    });
  }

  if (updated.status === "CANCELLED") {
    await cancelUnpaidCashInFeeStatement({
      cashInRequestId: updated.id,
      performedByUserId: input.performedByUserId,
    });
    return prisma.cashInRequest.findUniqueOrThrow({
      where: { id: updated.id },
      include: cashInRequestInclude,
    });
  }

  return updated;
}

export async function markCashInRequestPaidOffline(input: {
  id: string;
  performedByUserId: string;
  note?: string | null;
}) {
  await markCashInFeePaidOffline({
    cashInRequestId: input.id,
    performedByUserId: input.performedByUserId,
    note: input.note,
  });
  return prisma.cashInRequest.findUniqueOrThrow({
    where: { id: input.id },
    include: cashInRequestInclude,
  });
}

export async function listCashInRequestFormOptions(examBoardId: string) {
  const [series, codes] = await Promise.all([
    prisma.examSeries.findMany({
      where: { examBoardId },
      select: { id: true, name: true, year: true },
      orderBy: [{ year: "desc" }, { name: "asc" }],
    }),
    prisma.cashInCode.findMany({
      where: { examBoardId, active: true },
      select: {
        id: true,
        cashInCode: true,
        qualificationId: true,
        subjectId: true,
        qualification: { select: { id: true, name: true, level: true, code: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ qualification: { level: "asc" } }, { subject: { code: "asc" } }],
    }),
  ]);

  const qualificationMap = new Map<
    string,
    {
      id: string;
      name: string;
      level: string;
      code: string | null;
      subjects: Array<{ id: string; name: string; code: string; cashInCode: string }>;
    }
  >();

  for (const row of codes) {
    const existing = qualificationMap.get(row.qualificationId) ?? {
      id: row.qualification.id,
      name: row.qualification.name,
      level: row.qualification.level,
      code: row.qualification.code,
      subjects: [],
    };
    existing.subjects.push({
      id: row.subject.id,
      name: row.subject.name,
      code: row.subject.code,
      cashInCode: row.cashInCode,
    });
    qualificationMap.set(row.qualificationId, existing);
  }

  return {
    series,
    qualifications: [...qualificationMap.values()],
  };
}
