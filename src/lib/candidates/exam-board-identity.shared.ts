import type { CandidateExamIdentityStatus } from "@/generated/prisma/enums";

export const EXAM_BOARD_IDENTITY_EXPORT_COLUMNS = [
  "Student ID",
  "School Student Number",
  "Chinese Name",
  "English Name",
  "Exam Board",
  "Centre Number",
  "Candidate Number",
  "UCI Number",
  "Status",
  "Registered At",
] as const;

export const CANDIDATE_EXAM_IDENTITY_STATUS_OPTIONS: Array<{
  value: CandidateExamIdentityStatus;
  label: string;
}> = [
  { value: "PENDING", label: "Pending" },
  { value: "REGISTERED", label: "Registered" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "ARCHIVED", label: "Archived" },
];

const UCI_BOARD_CODES = new Set(["EDEXCEL", "PEARSON"]);

export type ExamBoardIdentityRules = {
  centreNumberRequired: boolean;
  candidateNumberRequired: boolean;
  uciNumberAllowed: boolean;
};

export function normalizeExamBoardKey(boardCode: string, boardName?: string | null): string {
  const code = boardCode.trim().toUpperCase();
  if (UCI_BOARD_CODES.has(code) || code === "EDEXCEL") return "EDEXCEL";
  if (code === "AQA") return "AQA";
  if (code === "CIE" || code === "CAMBRIDGE") return "CIE";

  const name = boardName?.trim().toUpperCase() ?? "";
  if (name.includes("EDEXCEL") || name.includes("PEARSON")) return "EDEXCEL";
  if (name.includes("AQA")) return "AQA";
  if (name.includes("CAMBRIDGE") || name.includes("CIE")) return "CIE";
  return code;
}

export function examBoardIdentityRules(
  boardCode: string,
  boardName?: string | null,
): ExamBoardIdentityRules {
  switch (normalizeExamBoardKey(boardCode, boardName)) {
    case "EDEXCEL":
      return {
        centreNumberRequired: true,
        candidateNumberRequired: false,
        uciNumberAllowed: true,
      };
    case "AQA":
    case "CIE":
      return {
        centreNumberRequired: true,
        candidateNumberRequired: false,
        uciNumberAllowed: false,
      };
    default:
      return {
        centreNumberRequired: true,
        candidateNumberRequired: false,
        uciNumberAllowed: false,
      };
  }
}

export function candidateExamIdentityStatusLabel(
  status: CandidateExamIdentityStatus | string | null | undefined,
): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "REGISTERED":
      return "Registered";
    case "WITHDRAWN":
      return "Withdrawn";
    case "ARCHIVED":
      return "Archived";
    default:
      return "—";
  }
}

/** @deprecated Use candidateExamIdentityStatusLabel */
export const examBoardRegistrationStatusLabel = candidateExamIdentityStatusLabel;

export function examBoardSupportsUci(boardCode: string | null | undefined): boolean {
  if (!boardCode) return false;
  return examBoardIdentityRules(boardCode).uciNumberAllowed;
}

export interface ExamBoardIdentityInput {
  centreNumber?: string | null;
  candidateNumber?: string | null;
  uciNumber?: string | null;
  status?: CandidateExamIdentityStatus | null;
  notes?: string | null;
}

export function validateExamBoardIdentityInput(
  boardCode: string,
  input: ExamBoardIdentityInput,
  boardName?: string | null,
): string[] {
  const errors: string[] = [];
  const rules = examBoardIdentityRules(boardCode, boardName);

  if (rules.centreNumberRequired && !input.centreNumber?.trim()) {
    errors.push("Centre Number is required");
  }
  if (rules.candidateNumberRequired && !input.candidateNumber?.trim()) {
    errors.push("Candidate Number is required");
  }
  if (!rules.uciNumberAllowed && input.uciNumber?.trim()) {
    errors.push("UCI Number is only used for Pearson / Edexcel identities");
  }

  return errors;
}

export function normalizeExamBoardIdentityInput(
  boardCode: string,
  input: ExamBoardIdentityInput,
  boardName?: string | null,
) {
  const rules = examBoardIdentityRules(boardCode, boardName);
  const status = input.status ?? ("PENDING" as CandidateExamIdentityStatus);
  return {
    centreNumber: input.centreNumber?.trim() || null,
    candidateNumber: input.candidateNumber?.trim() || null,
    uciNumber: rules.uciNumberAllowed ? input.uciNumber?.trim() || null : null,
    status,
    registeredAt: status === "REGISTERED" ? new Date() : null,
    notes: input.notes?.trim() || null,
  };
}

export interface ExamBoardIdentityRow {
  id: string;
  candidateId: string;
  candidateName: string;
  studentId: string | null;
  schoolStudentNumber: string | null;
  chineseName: string | null;
  englishName: string;
  examBoardId: string;
  examBoardCode: string;
  examBoardName: string;
  centreNumber: string | null;
  candidateNumber: string | null;
  uciNumber: string | null;
  status: CandidateExamIdentityStatus;
  registeredAt: string | null;
  notes: string | null;
}

export function examBoardIdentityRowsToCsv(rows: Record<string, string>[]): string {
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((row) =>
    EXAM_BOARD_IDENTITY_EXPORT_COLUMNS.map((column) => escape(row[column])).join(","),
  );
  return [EXAM_BOARD_IDENTITY_EXPORT_COLUMNS.join(","), ...lines].join("\n");
}

export function formatRegisteredAt(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}
