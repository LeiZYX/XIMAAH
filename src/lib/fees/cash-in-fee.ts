import type { FeeSchedule } from "@/generated/prisma/client";
import {
  findActiveFeeSchedule,
  type FeeScheduleLookupInput,
} from "@/lib/fees/fee-schedule";

export type CashInFeeMatchLevel =
  | "BOARD_SERIES_SUBJECT"
  | "BOARD_SERIES"
  | "BOARD_SUBJECT"
  | "BOARD";

export interface CashInFeeLookupInput {
  examBoardId: string;
  examSeriesId: string;
  qualificationId?: string | null;
  subjectId?: string | null;
  asOf?: Date;
}

export interface CashInFeeLookupCandidate extends FeeScheduleLookupInput {
  matchLevel: CashInFeeMatchLevel;
}

/**
 * Narrow → wide scopes for CASH_IN pricing:
 * 1) board + series + subject
 * 2) board + series
 * 3) board + subject (cross-series default)
 * 4) board only
 */
export function cashInFeeLookupCandidates(
  input: CashInFeeLookupInput,
): CashInFeeLookupCandidate[] {
  const asOf = input.asOf;
  const candidates: CashInFeeLookupCandidate[] = [];

  if (input.subjectId) {
    candidates.push({
      matchLevel: "BOARD_SERIES_SUBJECT",
      examBoardId: input.examBoardId,
      serviceType: "CASH_IN",
      examSeriesId: input.examSeriesId,
      qualificationId: input.qualificationId ?? null,
      subjectId: input.subjectId,
      paperId: null,
      entryType: null,
      reviewType: null,
      asOf,
    });
  }

  candidates.push({
    matchLevel: "BOARD_SERIES",
    examBoardId: input.examBoardId,
    serviceType: "CASH_IN",
    examSeriesId: input.examSeriesId,
    qualificationId: null,
    subjectId: null,
    paperId: null,
    entryType: null,
    reviewType: null,
    asOf,
  });

  if (input.subjectId) {
    candidates.push({
      matchLevel: "BOARD_SUBJECT",
      examBoardId: input.examBoardId,
      serviceType: "CASH_IN",
      examSeriesId: null,
      qualificationId: input.qualificationId ?? null,
      subjectId: input.subjectId,
      paperId: null,
      entryType: null,
      reviewType: null,
      asOf,
    });
  }

  candidates.push({
    matchLevel: "BOARD",
    examBoardId: input.examBoardId,
    serviceType: "CASH_IN",
    examSeriesId: null,
    qualificationId: null,
    subjectId: null,
    paperId: null,
    entryType: null,
    reviewType: null,
    asOf,
  });

  return candidates;
}

export async function resolveCashInFee(input: CashInFeeLookupInput): Promise<{
  schedule: FeeSchedule;
  matchLevel: CashInFeeMatchLevel;
} | null> {
  for (const candidate of cashInFeeLookupCandidates(input)) {
    const { matchLevel, ...lookup } = candidate;
    const schedule = await findActiveFeeSchedule(lookup);
    if (schedule) {
      return { schedule, matchLevel };
    }
  }
  return null;
}
