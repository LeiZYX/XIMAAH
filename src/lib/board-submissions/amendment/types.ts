import type { BulkEntrySlot } from "@/lib/board-submissions/bulk-entries/types";

export interface AmendmentSheetRow {
  candidateId: string;
  displayName: string;
  centreNumber: string | null;
  candidateNumber: string | null;
  entries: BulkEntrySlot[];
  issues: string[];
}

export interface AmendmentSubmissionRecord {
  baselineVersion: number;
  comparedAgainstVersion: number;
  submittedAt: string;
  submittedByName: string | null;
  addEntryCount: number;
  removeEntryCount: number;
  addRowCount: number;
  removeRowCount: number;
  canDownload: boolean;
}

export interface AmendmentPreview {
  registrationWindowId: string;
  registrationWindowTitle: string;
  examBoardCode: string;
  baselineVersion: number;
  baselineSubmittedAt: string;
  addRowCount: number;
  removeRowCount: number;
  addEntryCount: number;
  removeEntryCount: number;
  changedCandidateCount: number;
  addRows: AmendmentSheetRow[];
  removeRows: AmendmentSheetRow[];
  blockingIssues: string[];
  hasChanges: boolean;
  canExport: boolean;
  canSubmit: boolean;
  submissionHistory: AmendmentSubmissionRecord[];
}
