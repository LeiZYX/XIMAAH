export function resolvePermanentStudentId(input: {
  studentId?: string | null;
  candidate?: { studentId?: string | null } | null;
}): string | null {
  return input.candidate?.studentId?.trim() || input.studentId?.trim() || null;
}

export function formatPermanentStudentId(value: string | null | undefined): string {
  return value?.trim() || "—";
}

export function formatBoardCandidateNumberLabel(
  examBoardName: string | null | undefined,
  boardCandidateNumber: string | null | undefined,
): string {
  const number = boardCandidateNumber?.trim();
  if (!number) return "—";
  const board = examBoardName?.trim();
  return board ? `${board} · ${number}` : number;
}

export function examDocumentCandidateIdentifier(page: {
  permanentStudentId?: string | null;
  examBoard?: string | null;
  boardCandidateNumber?: string | null;
  candidateType?: string | null;
}): string {
  const studentId = page.permanentStudentId?.trim();
  if (studentId) return studentId;
  const boardNumber = formatBoardCandidateNumberLabel(page.examBoard, page.boardCandidateNumber);
  if (boardNumber !== "—") return boardNumber;
  return "—";
}
