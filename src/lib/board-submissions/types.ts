export type BoardSubmissionsTab = "bulk-entries" | "amendment";

export type TimelineSegmentKind =
  | "NOT_STARTED"
  | "STUDENT_OPEN"
  | "NORMAL"
  | "LATE"
  | "HIGH_LATE"
  | "EO_ADJUSTMENT"
  | "WINDOW_CLOSED";

export type TimelineMilestoneKind = "STUDENT_ADJUSTMENT_REQUEST_CLOSE";

export interface TimelineSegment {
  kind: TimelineSegmentKind;
  label: string;
  startAt: string;
  endAt: string;
  colorClass: string;
  isActive: boolean;
  isPast: boolean;
}

export interface TimelineMilestone {
  kind: TimelineMilestoneKind;
  label: string;
  at: string;
  /** Tailwind classes for the marker accent (e.g. border/bg). */
  markerClass: string;
  isPast: boolean;
}

export interface BoardSubmissionBaselineSummary {
  version: number;
  kind: "BULK_ENTRIES" | "AMENDMENT";
  submittedAt: string;
  submittedByName: string | null;
  candidateCount: number;
  entryCount: number;
  fileCount: number;
  notes: string | null;
}

export interface BoardSubmissionRegistrationSummary {
  candidateCount: number;
  examEntryCount: number;
  internalCandidateCount: number;
  externalCandidateCount: number;
  missingIdentityCount: number;
}

export interface BoardSubmissionFinancialSummary {
  totalReceivableGbp: number;
  amountDueGbp: number;
  paidGbp: number;
  pendingRefundGbp: number;
  completedRefundGbp: number;
  uncertainGbp: number;
  platformFeeGbp: number;
}

export interface BoardSubmissionWindowSummary {
  window: {
    id: string;
    title: string;
    status: string;
    academicYear: string;
    studentRegistrationOpenAt: string;
    studentRegistrationCloseAt: string;
    registrationCloseAt: string;
    examBoard: { id: string; name: string; code: string };
    examSeries: { id: string; name: string; year: number };
  };
  currentPhaseLabel: string;
  currentPhaseDetail: string;
  studentState: string;
  currentFeeStage: string | null;
  timeline: TimelineSegment[];
  milestones: TimelineMilestone[];
  nowAt: string;
  baseline: {
    status: "NONE" | "ESTABLISHED";
    latest: BoardSubmissionBaselineSummary | null;
    versionCount: number;
  };
  registration: BoardSubmissionRegistrationSummary;
  financial: BoardSubmissionFinancialSummary;
  recommendedTab: BoardSubmissionsTab;
}
