/**
 * Subject-first qualification resolution.
 * Operational flows pick Subject; Qualification is derived and stored for matching/FKs.
 */
export function resolveQualificationIdFromSubject(input: {
  subjectQualificationId: string;
  providedQualificationId?: string | null;
}): string {
  if (
    input.providedQualificationId &&
    input.providedQualificationId !== input.subjectQualificationId
  ) {
    throw new Error("Subject does not belong to the selected qualification");
  }
  return input.subjectQualificationId;
}

export function assertSubjectBelongsToExamBoard(input: {
  subjectExamBoardId: string;
  expectedExamBoardId: string;
}): void {
  if (input.subjectExamBoardId !== input.expectedExamBoardId) {
    throw new Error("Subject does not belong to the selected exam board");
  }
}

/** Returns true when stored qualificationId matches the subject's parent qualification. */
export function isQualificationConsistentWithSubject(input: {
  storedQualificationId: string;
  subjectQualificationId: string;
}): boolean {
  return input.storedQualificationId === input.subjectQualificationId;
}
