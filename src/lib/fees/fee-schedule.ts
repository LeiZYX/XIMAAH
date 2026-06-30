import type {
  FeeEntryType,
  FeeScheduleServiceType,
  FeeScheduleStatus,
} from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export interface FeeScheduleLookupInput {
  examBoardId: string;
  serviceType: FeeScheduleServiceType;
  qualificationId?: string | null;
  subjectId?: string | null;
  paperId?: string | null;
  entryType?: FeeEntryType | null;
  reviewType?: string | null;
  asOf?: Date;
}

export interface FeeScheduleVersionInput {
  examBoardId: string;
  serviceType: FeeScheduleServiceType;
  qualificationId?: string | null;
  subjectId?: string | null;
  paperId?: string | null;
  entryType?: FeeEntryType | null;
  reviewType?: string | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  costCurrency: "GBP" | "CNY";
  costAmount: number;
  salesCurrency: "GBP" | "CNY";
  salesAmount: number;
  markupType?: "PERCENTAGE" | "FIXED_AMOUNT" | null;
  markupValue?: number | null;
  exchangeRateToCny?: number | null;
  createdByUserId: string;
}

function scheduleScopeWhere(input: FeeScheduleLookupInput) {
  return {
    examBoardId: input.examBoardId,
    serviceType: input.serviceType,
    qualificationId: input.qualificationId ?? null,
    subjectId: input.subjectId ?? null,
    paperId: input.paperId ?? null,
    entryType: input.entryType ?? null,
    reviewType: input.reviewType ?? null,
  };
}

export async function findActiveFeeSchedule(input: FeeScheduleLookupInput) {
  const asOf = input.asOf ?? new Date();

  return prisma.feeSchedule.findFirst({
    where: {
      ...scheduleScopeWhere(input),
      status: "ACTIVE",
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    },
    orderBy: [{ version: "desc" }, { effectiveFrom: "desc" }],
  });
}

export async function getNextFeeScheduleVersion(input: FeeScheduleLookupInput) {
  const latest = await prisma.feeSchedule.findFirst({
    where: scheduleScopeWhere(input),
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return (latest?.version ?? 0) + 1;
}

export async function createFeeScheduleVersion(input: FeeScheduleVersionInput) {
  const scope = scheduleScopeWhere(input);
  const version = await getNextFeeScheduleVersion(input);

  await prisma.feeSchedule.updateMany({
    where: {
      ...scope,
      status: "ACTIVE",
    },
    data: {
      status: "INACTIVE" as FeeScheduleStatus,
      effectiveTo: input.effectiveFrom,
    },
  });

  return prisma.feeSchedule.create({
    data: {
      ...scope,
      version,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? undefined,
      status: "ACTIVE",
      costCurrency: input.costCurrency,
      costAmount: input.costAmount,
      salesCurrency: input.salesCurrency,
      salesAmount: input.salesAmount,
      markupType: input.markupType ?? undefined,
      markupValue: input.markupValue ?? undefined,
      exchangeRateToCny: input.exchangeRateToCny ?? undefined,
      createdByUserId: input.createdByUserId,
    },
  });
}
