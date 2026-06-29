import type { RegistrationWindowStatus } from "@/generated/prisma/enums";
import {
  resolveCurrentFeeStageDisplay,
  feeStageLabel,
  type RegistrationFeeStageRecord,
} from "@/lib/registrations/fee-stages";
import {
  resolveStudentRegistrationState,
  studentRegistrationStateLabel,
  type StudentRegistrationState,
} from "@/lib/registrations/window";

export interface RegistrationWindowListSummary {
  studentState: StudentRegistrationState;
  studentStateLabel: string;
  currentFeeStage: string;
  normalFeeStagePeriod: string | null;
  lateFeeStagePeriod: string | null;
  highLateFeeStagePeriod: string | null;
}

function formatPeriod(startAt: Date, endAt: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  return `${fmt(startAt)} – ${fmt(endAt)}`;
}

export function summarizeRegistrationWindow(
  window: {
    status: RegistrationWindowStatus;
    studentRegistrationOpenAt: Date;
    studentRegistrationCloseAt: Date;
    registrationCloseAt: Date;
  },
  feeStages: RegistrationFeeStageRecord[],
  now = new Date(),
): RegistrationWindowListSummary {
  const byCode = Object.fromEntries(feeStages.map((s) => [s.stageCode, s]));
  const studentState = resolveStudentRegistrationState(window, now);

  return {
    studentState,
    studentStateLabel: studentRegistrationStateLabel(studentState),
    currentFeeStage: resolveCurrentFeeStageDisplay(feeStages, now),
    normalFeeStagePeriod: byCode.NORMAL
      ? formatPeriod(byCode.NORMAL.startAt, byCode.NORMAL.endAt)
      : null,
    lateFeeStagePeriod: byCode.LATE
      ? formatPeriod(byCode.LATE.startAt, byCode.LATE.endAt)
      : null,
    highLateFeeStagePeriod: byCode.HIGH_LATE
      ? formatPeriod(byCode.HIGH_LATE.startAt, byCode.HIGH_LATE.endAt)
      : null,
  };
}

/** @deprecated Use summarizeRegistrationWindow */
export function summarizeRegistrationWindowStages(
  window: {
    status: RegistrationWindowStatus;
    studentRegistrationOpenAt: Date;
    studentRegistrationCloseAt: Date;
    registrationCloseAt: Date;
  },
  feeStages: RegistrationFeeStageRecord[],
  now = new Date(),
) {
  const summary = summarizeRegistrationWindow(window, feeStages, now);
  return {
    currentStage: summary.currentFeeStage,
    normalEntryPeriod: summary.normalFeeStagePeriod,
    lateEntryPeriod: summary.lateFeeStagePeriod,
    highLateEntryPeriod: summary.highLateFeeStagePeriod,
    studentState: summary.studentState,
    studentStateLabel: summary.studentStateLabel,
    currentFeeStage: summary.currentFeeStage,
  };
}

export function stageLabelForCode(code: string): string {
  return feeStageLabel(code);
}
