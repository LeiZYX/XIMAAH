import { normalizeExamBoardKey } from "@/lib/candidates/exam-board-identity.shared";

export type ExamBoardBranch = "CIE" | "EDEXCEL" | "AQA" | "OTHER";

export function resolveExamBoardBranch(
  boardCode: string,
  boardName?: string | null,
): ExamBoardBranch {
  const key = normalizeExamBoardKey(boardCode, boardName);
  if (key === "CIE") return "CIE";
  if (key === "EDEXCEL") return "EDEXCEL";
  if (key === "AQA") return "AQA";
  return "OTHER";
}

export function isCieExamBoard(boardCode: string, boardName?: string | null): boolean {
  return resolveExamBoardBranch(boardCode, boardName) === "CIE";
}

export function isEdexcelExamBoard(boardCode: string, boardName?: string | null): boolean {
  return resolveExamBoardBranch(boardCode, boardName) === "EDEXCEL";
}

/** Pearson Bulk Entries / Amendment channel (Edexcel IAL etc.). */
export function usesPearsonBulkEntries(boardCode: string, boardName?: string | null): boolean {
  return isEdexcelExamBoard(boardCode, boardName);
}

/** Cambridge Direct / CIE Entries channel. */
export function usesCieEntries(boardCode: string, boardName?: string | null): boolean {
  return isCieExamBoard(boardCode, boardName);
}

/** Phase-1 subject-teacher confirmation switch is only exposed for CIE windows. */
export function canConfigureSubjectTeacherConfirmation(
  boardCode: string,
  boardName?: string | null,
): boolean {
  return isCieExamBoard(boardCode, boardName);
}
