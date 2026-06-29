import type { RegistrationWindowStatus } from "@/generated/prisma/enums";
import {
  resolveCurrentFeeStageDisplay,
  type RegistrationFeeStageRecord,
} from "@/lib/registrations/fee-stages";
import { resolveStudentRegistrationState } from "@/lib/registrations/window";

/** @deprecated Import from @/lib/registrations/fee-stages instead */
export {
  assertFeeStageDatesValid,
  assertRegistrationWindowTimingValid,
  assertStageDatesValid,
  DEFAULT_FEE_STAGE_TEMPLATES as DEFAULT_STAGE_TEMPLATES,
  entryTypeLabel,
  feeStageLabel,
  isLateEntryType,
  resolveActiveFeeStage,
  resolveActiveStage,
  resolveCurrentFeeStageDisplay,
  resolveEntryTypeForRegistration,
  type CurrentFeeStageDisplay,
  type EntryTypeResolution,
  type RegistrationFeeStageRecord,
  type RegistrationStageRecord,
} from "@/lib/registrations/fee-stages";

/** @deprecated Use CurrentFeeStageDisplay */
export type CurrentStageDisplay =
  | "Normal Entry"
  | "Late Entry"
  | "High Late Entry"
  | "Closed"
  | "Not Started";

export function resolveCurrentStageDisplay(
  window: {
    status: RegistrationWindowStatus;
    studentRegistrationOpenAt: Date;
    studentRegistrationCloseAt: Date;
    registrationCloseAt: Date;
  },
  feeStages: RegistrationFeeStageRecord[],
  now = new Date(),
): CurrentStageDisplay {
  const studentState = resolveStudentRegistrationState(window, now);
  if (studentState === "WINDOW_CLOSED") return "Closed";
  if (studentState === "NOT_STARTED") return "Not Started";

  const feeStage = resolveCurrentFeeStageDisplay(feeStages, now);
  switch (feeStage) {
    case "Normal":
      return "Normal Entry";
    case "Late":
      return "Late Entry";
    case "High Late":
      return "High Late Entry";
    default:
      return "Not Started";
  }
}

export const STUDENT_LATE_PHASE_CONTACT_MESSAGE =
  "Student registration has closed. Please contact your subject teacher or the Exams Office if changes are required.";

/** @deprecated Student lock is based on studentRegistrationCloseAt, not fee stages */
export function hasNormalEntryEnded(): boolean {
  return false;
}

/** @deprecated */
export function isNormalEntryActive(): boolean {
  return false;
}

/** @deprecated */
export function isLateOrHighLatePhase(): boolean {
  return false;
}

/** @deprecated Fee stages are optional and no longer auto-created */
export function buildDefaultStagesForWindow(): never[] {
  return [];
}
