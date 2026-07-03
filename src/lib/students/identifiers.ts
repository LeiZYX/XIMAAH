/**
 * Student identifier roles in XIMA Assessment Hub.
 *
 * - permanentStudentId (Candidate.studentId): STU-YYYY-000001, system-generated, immutable
 * - schoolStudentNumber (User.studentNo / Candidate.studentNumber): optional school login number
 * - assessmentHubNumber (Candidate.assessmentHubCandidateNumber): internal AH registry number
 * - boardCandidateNumber (CandidateExamIdentity.boardCandidateNumber): per-exam-board number only
 */

export const PERMANENT_STUDENT_ID_PATTERN = /^STU-\d{4}-\d{6}$/;

export function formatStudentId(year: number, sequence: number): string {
  return `STU-${year}-${String(sequence).padStart(6, "0")}`;
}

export function isPermanentStudentId(value: string | null | undefined): boolean {
  if (!value) return false;
  return PERMANENT_STUDENT_ID_PATTERN.test(value.trim());
}

export function assertStudentIdNotProvided(value: unknown, fieldName = "studentId"): void {
  if (value !== undefined && value !== null && String(value).trim() !== "") {
    throw new Error(`${fieldName} is system-generated and cannot be supplied`);
  }
}

export function resolveSchoolStudentNumber(input: {
  studentNumber?: string | null;
}): string | undefined {
  const studentNumber = input.studentNumber?.trim();
  return studentNumber || undefined;
}

export function registrationStudentNumberSnapshot(input: {
  studentNumber?: string | null;
  permanentStudentId?: string | null;
}): string {
  return (
    resolveSchoolStudentNumber(input) ??
    (input.permanentStudentId?.trim() || "—")
  );
}
