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

export function applyWindowTimingToFeeStage<T extends FeeStageTimingInput>(
  stage: T,
  window: RegistrationWindowTimingSource,
): T {
  if (stage.stageCode === "NORMAL") {
    return {
      ...stage,
      startAt: window.studentRegistrationOpenAt,
      endAt: window.studentRegistrationCloseAt,
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
  if (stageCode === "NORMAL") return true;
  if (stageCode === "HIGH_LATE" && field === "endAt") return true;
  return false;
}
