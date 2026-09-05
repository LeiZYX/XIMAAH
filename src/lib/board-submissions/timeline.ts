import type { RegistrationFeeStageRecord } from "@/lib/registrations/fee-stages";
import {
  feeStageLabel,
  resolveCurrentFeeStageDisplay,
} from "@/lib/registrations/fee-stages";
import {
  resolveStudentAdjustmentRequestCloseAt,
  resolveStudentRegistrationState,
  studentRegistrationStateLabel,
  type RegistrationWindowTiming,
  type StudentAdjustmentWindowTiming,
} from "@/lib/registrations/window";
import type {
  TimelineMilestone,
  TimelineSegment,
  TimelineSegmentKind,
} from "@/lib/board-submissions/types";

const SEGMENT_COLORS: Record<TimelineSegmentKind, string> = {
  NOT_STARTED: "bg-slate-200",
  STUDENT_OPEN: "bg-emerald-400",
  NORMAL: "bg-sky-400",
  LATE: "bg-amber-400",
  HIGH_LATE: "bg-orange-500",
  EO_ADJUSTMENT: "bg-violet-400",
  WINDOW_CLOSED: "bg-slate-500",
};

/** Who may register / adjust — orthogonal to fee pricing stages. */
export const PERMISSION_TIMELINE_KINDS: ReadonlySet<TimelineSegmentKind> = new Set([
  "NOT_STARTED",
  "STUDENT_OPEN",
  "EO_ADJUSTMENT",
  "WINDOW_CLOSED",
]);

/** Fee entry pricing stages. */
export const FEE_TIMELINE_KINDS: ReadonlySet<TimelineSegmentKind> = new Set([
  "NORMAL",
  "LATE",
  "HIGH_LATE",
]);

export function splitTimelineTracks(segments: TimelineSegment[]): {
  permission: TimelineSegment[];
  fee: TimelineSegment[];
} {
  return {
    permission: segments.filter((segment) => PERMISSION_TIMELINE_KINDS.has(segment.kind)),
    fee: segments.filter((segment) => FEE_TIMELINE_KINDS.has(segment.kind)),
  };
}

function segmentState(startAt: Date, endAt: Date, now: Date) {
  return {
    isActive: now >= startAt && now <= endAt,
    isPast: now > endAt,
  };
}

function feeStageSegment(
  stage: RegistrationFeeStageRecord,
  now: Date,
): TimelineSegment {
  const { isActive, isPast } = segmentState(stage.startAt, stage.endAt, now);
  const kind: TimelineSegmentKind =
    stage.stageCode === "NORMAL"
      ? "NORMAL"
      : stage.stageCode === "LATE"
        ? "LATE"
        : "HIGH_LATE";

  return {
    kind,
    label: feeStageLabel(stage.stageCode),
    startAt: stage.startAt.toISOString(),
    endAt: stage.endAt.toISOString(),
    colorClass: SEGMENT_COLORS[kind],
    isActive,
    isPast,
  };
}

export function buildBoardSubmissionTimeline(
  window: RegistrationWindowTiming & {
    studentRegistrationOpenAt: Date;
    studentRegistrationCloseAt: Date;
    registrationCloseAt: Date;
  },
  feeStages: RegistrationFeeStageRecord[],
  now = new Date(),
): TimelineSegment[] {
  const segments: TimelineSegment[] = [];

  if (now < window.studentRegistrationOpenAt) {
    // Keep a short pre-open marker (not epoch) so absolute timelines stay sane.
    const preStart = new Date(window.studentRegistrationOpenAt.getTime() - 24 * 60 * 60 * 1000);
    const { isActive, isPast } = segmentState(preStart, window.studentRegistrationOpenAt, now);
    segments.push({
      kind: "NOT_STARTED",
      label: "Not started",
      startAt: preStart.toISOString(),
      endAt: window.studentRegistrationOpenAt.toISOString(),
      colorClass: SEGMENT_COLORS.NOT_STARTED,
      isActive,
      isPast,
    });
  }

  const studentOpenState = segmentState(
    window.studentRegistrationOpenAt,
    window.studentRegistrationCloseAt,
    now,
  );
  segments.push({
    kind: "STUDENT_OPEN",
    label: "Student registration",
    startAt: window.studentRegistrationOpenAt.toISOString(),
    endAt: window.studentRegistrationCloseAt.toISOString(),
    colorClass: SEGMENT_COLORS.STUDENT_OPEN,
    ...studentOpenState,
  });

  const enabledStages = feeStages
    .filter((stage) => stage.enabled)
    .sort((a, b) => a.sequence - b.sequence);

  for (const stage of enabledStages) {
    segments.push(feeStageSegment(stage, now));
  }

  if (window.studentRegistrationCloseAt < window.registrationCloseAt) {
    const eoState = segmentState(
      window.studentRegistrationCloseAt,
      window.registrationCloseAt,
      now,
    );
    segments.push({
      kind: "EO_ADJUSTMENT",
      label: "EO adjustment",
      startAt: window.studentRegistrationCloseAt.toISOString(),
      endAt: window.registrationCloseAt.toISOString(),
      colorClass: SEGMENT_COLORS.EO_ADJUSTMENT,
      ...eoState,
    });
  }

  const closeStart = window.registrationCloseAt;
  const closeEnd = new Date(window.registrationCloseAt.getTime() + 24 * 60 * 60 * 1000);
  segments.push({
    kind: "WINDOW_CLOSED",
    label: "Window closed",
    startAt: closeStart.toISOString(),
    endAt: closeEnd.toISOString(),
    colorClass: SEGMENT_COLORS.WINDOW_CLOSED,
    isActive: now >= closeStart,
    isPast: false,
  });

  return segments;
}

export function buildBoardSubmissionMilestones(
  window: StudentAdjustmentWindowTiming & {
    studentRegistrationOpenAt: Date;
    studentRegistrationCloseAt: Date;
    registrationCloseAt: Date;
  },
  now = new Date(),
): TimelineMilestone[] {
  if (!window.studentAdjustmentRequestEnabled) {
    return [];
  }

  const closeAt = resolveStudentAdjustmentRequestCloseAt(window);
  return [
    {
      kind: "STUDENT_ADJUSTMENT_REQUEST_CLOSE",
      label: "Student adjustment request close",
      at: closeAt.toISOString(),
      markerClass: "border-fuchsia-600 bg-fuchsia-500",
      isPast: now > closeAt,
    },
  ];
}

export function resolveBoardSubmissionPhaseLabel(
  window: RegistrationWindowTiming,
  feeStages: RegistrationFeeStageRecord[],
  now = new Date(),
): { label: string; detail: string; studentState: string; currentFeeStage: string | null } {
  const studentState = resolveStudentRegistrationState(window, now);
  const studentLabel = studentRegistrationStateLabel(studentState);
  const currentFeeStage =
    studentState === "NOT_STARTED" || studentState === "WINDOW_CLOSED"
      ? null
      : resolveCurrentFeeStageDisplay(feeStages, now);

  if (studentState === "NOT_STARTED") {
    return {
      label: "Registration not started",
      detail: "The registration window has not opened yet.",
      studentState: studentLabel,
      currentFeeStage,
    };
  }

  if (studentState === "WINDOW_CLOSED") {
    return {
      label: "Window closed",
      detail: "The registration window has closed.",
      studentState: studentLabel,
      currentFeeStage: null,
    };
  }

  const feePart =
    currentFeeStage && currentFeeStage !== "Not Configured"
      ? `${currentFeeStage} entry period`
      : "Fee stage not configured";

  if (studentState === "STUDENT_LOCKED") {
    return {
      label: `${feePart} · EO adjustment`,
      detail: "Student self-registration has closed. Exams Office can still adjust registrations.",
      studentState: studentLabel,
      currentFeeStage,
    };
  }

  return {
    label: `${feePart} · Student registration open`,
    detail: "Students and staff can register within the current fee stage.",
    studentState: studentLabel,
    currentFeeStage,
  };
}

export function recommendBoardSubmissionsTab(
  window: RegistrationWindowTiming,
  feeStages: RegistrationFeeStageRecord[],
  hasBaseline: boolean,
  now = new Date(),
): "bulk-entries" | "amendment" {
  if (!hasBaseline) return "bulk-entries";

  const normalStage = feeStages.find((stage) => stage.enabled && stage.stageCode === "NORMAL");
  if (normalStage && now > normalStage.endAt) {
    return "amendment";
  }

  const studentState = resolveStudentRegistrationState(window, now);
  if (studentState === "STUDENT_LOCKED" || studentState === "WINDOW_CLOSED") {
    return "amendment";
  }

  return "bulk-entries";
}
