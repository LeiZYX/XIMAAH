import type { RegistrationType } from "@/generated/prisma/enums";

export interface BulkEntrySlot {
  specification: string;
  specOption: string;
}

export interface BulkEntriesRegistrationTypeCounts {
  internal: number;
  restricted: number;
  external: number;
}

export interface BulkEntriesCandidateRow {
  candidateId: string;
  displayName: string;
  candidateType: string;
  registrationTypes: RegistrationType[];
  uciNumber: string | null;
  candidateNumber: string | null;
  firstName: string;
  lastName: string;
  gender: string | null;
  dateOfBirth: string | null;
  entries: BulkEntrySlot[];
  issues: string[];
  filePartCount: number;
}

export interface BulkEntriesPreview {
  registrationWindowId: string;
  registrationWindowTitle: string;
  examBoardCode: string;
  candidateCount: number;
  entryCount: number;
  fileCount: number;
  registrationTypeCounts: BulkEntriesRegistrationTypeCounts;
  rows: BulkEntriesCandidateRow[];
  blockingIssues: string[];
  canExport: boolean;
  canSubmit: boolean;
}

export interface BulkEntriesFilePart {
  partIndex: number;
  partCount: number;
  rowCount: number;
  rows: BulkEntriesCandidateRow[];
}

export interface BulkEntriesSnapshotRow {
  candidateId: string;
  entries: BulkEntrySlot[];
}
