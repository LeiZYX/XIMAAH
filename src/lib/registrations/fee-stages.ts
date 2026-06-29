import type { FeeEntryType } from "@/generated/prisma/enums";
import { RegistrationError } from "@/lib/registrations/errors";

export interface RegistrationFeeStageRecord {
  id: string;
  registrationWindowId: string;
  stageCode: FeeEntryType;
  stageName: string;
  sequence: number;
  startAt: Date;
  endAt: Date;
  enabled: boolean;
  notes?: string | null;
}

/** @deprecated Use RegistrationFeeStageRecord */
export type RegistrationStageRecord = RegistrationFeeStageRecord;

export type CurrentFeeStageDisplay =
  | "Normal"
  | "Late"
  | "High Late"
  | "Not Configured";

export const DEFAULT_FEE_STAGE_TEMPLATES: Array<{
  stageCode: FeeEntryType;
  stageName: string;
  sequence: number;
}> = [
  { stageCode: "NORMAL", stageName: "Normal", sequence: 1 },
  { stageCode: "LATE", stageName: "Late", sequence: 2 },
  { stageCode: "HIGH_LATE", stageName: "High Late", sequence: 3 },
];

export function feeStageLabel(entryType: FeeEntryType | string): string {
  switch (entryType) {
    case "NORMAL":
      return "Normal";
    case "LATE":
      return "Late";
    case "HIGH_LATE":
      return "High Late";
    default:
      return String(entryType);
  }
}

/** @deprecated Use feeStageLabel */
export const entryTypeLabel = feeStageLabel;

export function isLateEntryType(entryType: FeeEntryType): boolean {
  return entryType === "LATE" || entryType === "HIGH_LATE";
}

export function resolveActiveFeeStage(
  feeStages: RegistrationFeeStageRecord[],
  now = new Date(),
): RegistrationFeeStageRecord | null {
  const enabled = feeStages.filter((stage) => stage.enabled);
  if (enabled.length === 0) return null;

  const candidates = enabled
    .filter((stage) => now >= stage.startAt && now <= stage.endAt)
    .sort((a, b) => a.sequence - b.sequence);

  return candidates[0] ?? null;
}

/** @deprecated Use resolveActiveFeeStage */
export const resolveActiveStage = resolveActiveFeeStage;

export function resolveCurrentFeeStageDisplay(
  feeStages: RegistrationFeeStageRecord[],
  now = new Date(),
): CurrentFeeStageDisplay {
  if (!feeStages.some((stage) => stage.enabled)) return "Not Configured";
  const active = resolveActiveFeeStage(feeStages, now);
  if (!active) return "Not Configured";
  return feeStageLabel(active.stageCode) as CurrentFeeStageDisplay;
}

export function assertFeeStageDatesValid(
  feeStages: Array<Pick<RegistrationFeeStageRecord, "stageCode" | "startAt" | "endAt" | "enabled">>,
  window?: { studentRegistrationOpenAt: Date; registrationCloseAt: Date },
): void {
  for (const stage of feeStages) {
    if (stage.startAt >= stage.endAt) {
      throw new RegistrationError(
        `${feeStageLabel(stage.stageCode)}: start date must be before end date`,
        400,
      );
    }

    if (window && stage.enabled) {
      if (stage.startAt < window.studentRegistrationOpenAt) {
        throw new RegistrationError(
          `${feeStageLabel(stage.stageCode)}: start date should fall within the registration window`,
          400,
        );
      }
      if (stage.endAt > window.registrationCloseAt) {
        throw new RegistrationError(
          `${feeStageLabel(stage.stageCode)}: end date should fall within the registration window`,
          400,
        );
      }
    }
  }

  const enabled = feeStages.filter((s) => s.enabled);
  for (let i = 0; i < enabled.length; i += 1) {
    for (let j = i + 1; j < enabled.length; j += 1) {
      const a = enabled[i];
      const b = enabled[j];
      const overlaps = a.startAt <= b.endAt && b.startAt <= a.endAt;
      if (overlaps) {
        throw new RegistrationError(
          `Fee stages overlap: ${feeStageLabel(a.stageCode)} and ${feeStageLabel(b.stageCode)}`,
          400,
        );
      }
    }
  }
}

/** @deprecated Use assertFeeStageDatesValid */
export const assertStageDatesValid = assertFeeStageDatesValid;

export interface EntryTypeResolution {
  entryType: FeeEntryType;
  feeStageId: string | null;
  entryTypeOverridden: boolean;
  isLateRegistration: boolean;
  defaultedToNormal: boolean;
}

export function resolveEntryTypeForRegistration(input: {
  feeStages: RegistrationFeeStageRecord[];
  now?: Date;
  overrideEntryType?: FeeEntryType;
  allowOverride?: boolean;
}): EntryTypeResolution {
  const now = input.now ?? new Date();
  const enabledStages = input.feeStages.filter((stage) => stage.enabled);
  const active = resolveActiveFeeStage(enabledStages, now);

  if (input.overrideEntryType && input.allowOverride) {
    return {
      entryType: input.overrideEntryType,
      feeStageId: active?.id ?? null,
      entryTypeOverridden: true,
      isLateRegistration: isLateEntryType(input.overrideEntryType),
      defaultedToNormal: false,
    };
  }

  if (enabledStages.length === 0) {
    return {
      entryType: "NORMAL",
      feeStageId: null,
      entryTypeOverridden: false,
      isLateRegistration: false,
      defaultedToNormal: true,
    };
  }

  if (!active) {
    return {
      entryType: "NORMAL",
      feeStageId: null,
      entryTypeOverridden: false,
      isLateRegistration: false,
      defaultedToNormal: true,
    };
  }

  return {
    entryType: active.stageCode,
    feeStageId: active.id,
    entryTypeOverridden: false,
    isLateRegistration: isLateEntryType(active.stageCode),
    defaultedToNormal: false,
  };
}

export function assertRegistrationWindowTimingValid(input: {
  studentRegistrationOpenAt: Date;
  studentRegistrationCloseAt: Date;
  registrationCloseAt: Date;
}): void {
  if (input.studentRegistrationOpenAt >= input.studentRegistrationCloseAt) {
    throw new RegistrationError(
      "Student registration open time must be before student registration close time",
      400,
    );
  }
  if (input.studentRegistrationCloseAt > input.registrationCloseAt) {
    throw new RegistrationError(
      "Student registration close time must be on or before registration close time",
      400,
    );
  }
}
