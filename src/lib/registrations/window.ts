import type { RegistrationWindowStatus } from "@/generated/prisma/enums";
import {
  resolveCurrentFeeStageDisplay,
  type RegistrationFeeStageRecord,
} from "@/lib/registrations/fee-stages";

export interface RegistrationWindowTiming {
  status: RegistrationWindowStatus;
  studentRegistrationOpenAt: Date;
  studentRegistrationCloseAt: Date;
  registrationCloseAt: Date;
  studentSelfRegistrationEnabled?: boolean;
}

export type StudentRegistrationState =
  | "NOT_STARTED"
  | "OPEN"
  | "STUDENT_LOCKED"
  | "WINDOW_CLOSED";

export const STUDENT_REGISTRATION_CLOSED_MESSAGE =
  "Student registration has closed. Please contact your subject teacher or the Exams Office if changes are required.";

export function studentRegistrationStateLabel(state: StudentRegistrationState): string {
  switch (state) {
    case "NOT_STARTED":
      return "Not Started";
    case "OPEN":
      return "Open";
    case "STUDENT_LOCKED":
      return "Student Locked";
    case "WINDOW_CLOSED":
      return "Window Closed";
  }
}

export function resolveStudentRegistrationState(
  window: RegistrationWindowTiming,
  now = new Date(),
): StudentRegistrationState {
  if (window.status === "CLOSED" || window.status === "ARCHIVED") {
    return "WINDOW_CLOSED";
  }
  if (now > window.registrationCloseAt) {
    return "WINDOW_CLOSED";
  }
  if (window.status !== "OPEN") {
    return "NOT_STARTED";
  }
  if (now < window.studentRegistrationOpenAt) {
    return "NOT_STARTED";
  }
  if (now > window.studentRegistrationCloseAt) {
    return "STUDENT_LOCKED";
  }
  return "OPEN";
}

export function isRegistrationWindowOpenForStaff(
  window: RegistrationWindowTiming,
  now = new Date(),
): boolean {
  if (window.status !== "OPEN") return false;
  return now <= window.registrationCloseAt;
}

/** @deprecated Use isRegistrationWindowOpenForStaff */
export function canRegisterInWindow(
  window: RegistrationWindowTiming,
  now = new Date(),
): boolean {
  return isRegistrationWindowOpenForStaff(window, now);
}

export function canStudentRegisterInWindow(
  window: RegistrationWindowTiming,
  _feeStages?: RegistrationFeeStageRecord[],
  now = new Date(),
): boolean {
  if (!window.studentSelfRegistrationEnabled) return false;
  return resolveStudentRegistrationState(window, now) === "OPEN";
}

export function canStudentEditRegistrationList(
  window: RegistrationWindowTiming,
  feeStages?: RegistrationFeeStageRecord[],
  now = new Date(),
): boolean {
  return canStudentRegisterInWindow(window, feeStages, now);
}

export function isStudentRegistrationPeriodClosed(
  window: RegistrationWindowTiming,
  now = new Date(),
): boolean {
  const state = resolveStudentRegistrationState(window, now);
  return state === "STUDENT_LOCKED" || state === "WINDOW_CLOSED";
}

export function canTeacherSubmitChangeRequest(
  window: RegistrationWindowTiming,
  now = new Date(),
): boolean {
  if (window.status !== "OPEN") return false;
  if (now > window.registrationCloseAt) return false;
  return now > window.studentRegistrationCloseAt;
}

export function describeStudentRegistrationAvailability(
  window:
    | (RegistrationWindowTiming & { title?: string })
    | null
    | undefined,
  feeStages: RegistrationFeeStageRecord[],
  now = new Date(),
): {
  open: boolean;
  reason: string | null;
  currentFeeStage: string | null;
  studentState: StudentRegistrationState;
  windowTitle: string | null;
  studentListLocked: boolean;
  showStaffContactHint: boolean;
} {
  if (!window) {
    return {
      open: false,
      reason: "No registration window is configured for this exam board and series.",
      currentFeeStage: null,
      studentState: "NOT_STARTED",
      windowTitle: null,
      studentListLocked: false,
      showStaffContactHint: false,
    };
  }

  const windowTitle = window.title ?? null;
  const studentState = resolveStudentRegistrationState(window, now);
  const currentFeeStage = resolveCurrentFeeStageDisplay(feeStages, now);
  const studentListLocked = studentState !== "OPEN";
  const showStaffContactHint = studentState === "STUDENT_LOCKED";

  if (window.status !== "OPEN") {
    return {
      open: false,
      reason: `Registration window is ${window.status.toLowerCase()}.`,
      currentFeeStage,
      studentState,
      windowTitle,
      studentListLocked,
      showStaffContactHint: false,
    };
  }

  if (window.studentSelfRegistrationEnabled === false) {
    return {
      open: false,
      reason: "Student self-registration is disabled for this window.",
      currentFeeStage,
      studentState,
      windowTitle,
      studentListLocked,
      showStaffContactHint,
    };
  }

  if (studentState === "NOT_STARTED") {
    return {
      open: false,
      reason: "Registration not yet open.",
      currentFeeStage,
      studentState,
      windowTitle,
      studentListLocked: false,
      showStaffContactHint: false,
    };
  }

  if (studentState === "WINDOW_CLOSED") {
    return {
      open: false,
      reason: "Registration window closed.",
      currentFeeStage,
      studentState,
      windowTitle,
      studentListLocked: true,
      showStaffContactHint: false,
    };
  }

  if (studentState === "STUDENT_LOCKED") {
    return {
      open: false,
      reason: STUDENT_REGISTRATION_CLOSED_MESSAGE,
      currentFeeStage,
      studentState,
      windowTitle,
      studentListLocked: true,
      showStaffContactHint: true,
    };
  }

  return {
    open: true,
    reason: null,
    currentFeeStage,
    studentState,
    windowTitle,
    studentListLocked: false,
    showStaffContactHint: false,
  };
}
