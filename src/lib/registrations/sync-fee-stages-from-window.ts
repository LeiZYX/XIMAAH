import type { FeeEntryType } from "@/generated/prisma/enums";

export type RegistrationWindowTimingSource = {
  studentRegistrationOpenAt: Date;
  studentRegistrationCloseAt: Date;
  registrationCloseAt: Date;
};

type FeeStageTimingInput = {
  stageCode: FeeEntryType;
  startAt: Date | string;
  endAt: Date | string;
};

function asDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Window-bound fee stage fields:
 * - Normal start → Student registration open (always)
 * - Normal end → editable; defaults to Student registration close when empty
 * - High Late end → Registration close (always)
 */
export function applyWindowTimingToFeeStage<T extends FeeStageTimingInput>(
  stage: T,
  window: RegistrationWindowTimingSource,
): T {
  if (stage.stageCode === "NORMAL") {
    const existingEnd = asDate(stage.endAt);
    return {
      ...stage,
      startAt: window.studentRegistrationOpenAt,
      endAt: existingEnd ?? window.studentRegistrationCloseAt,
    };
  }

  if (stage.stageCode === "HIGH_LATE") {
    return {
      ...stage,
      endAt: window.registrationCloseAt,
    };
  }

  return stage;
}

export function applyWindowTimingToFeeStages<T extends FeeStageTimingInput>(
  feeStages: T[],
  window: RegistrationWindowTimingSource,
): T[] {
  return feeStages.map((stage) => applyWindowTimingToFeeStage(stage, window));
}

export function isFeeStageFieldBoundByWindow(
  stageCode: FeeEntryType,
  field: "startAt" | "endAt",
): boolean {
  if (stageCode === "NORMAL" && field === "startAt") return true;
  if (stageCode === "HIGH_LATE" && field === "endAt") return true;
  return false;
}
