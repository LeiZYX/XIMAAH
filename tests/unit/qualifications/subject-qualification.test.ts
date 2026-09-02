import { describe, expect, it } from "vitest";
import {
  assertSubjectBelongsToExamBoard,
  isQualificationConsistentWithSubject,
  resolveQualificationIdFromSubject,
} from "@/lib/qualifications/subject-qualification";

describe("resolveQualificationIdFromSubject", () => {
  it("returns subject qualification when none is provided", () => {
    expect(
      resolveQualificationIdFromSubject({
        subjectQualificationId: "qual-from-subject",
      }),
    ).toBe("qual-from-subject");
  });

  it("returns subject qualification when provided value matches", () => {
    expect(
      resolveQualificationIdFromSubject({
        subjectQualificationId: "qual-from-subject",
        providedQualificationId: "qual-from-subject",
      }),
    ).toBe("qual-from-subject");
  });

  it("rejects mismatched provided qualification", () => {
    expect(() =>
      resolveQualificationIdFromSubject({
        subjectQualificationId: "qual-from-subject",
        providedQualificationId: "qual-other",
      }),
    ).toThrow("Subject does not belong to the selected qualification");
  });
});

describe("assertSubjectBelongsToExamBoard", () => {
  it("passes when board ids match", () => {
    expect(() =>
      assertSubjectBelongsToExamBoard({
        subjectExamBoardId: "board-1",
        expectedExamBoardId: "board-1",
      }),
    ).not.toThrow();
  });

  it("throws when board ids differ", () => {
    expect(() =>
      assertSubjectBelongsToExamBoard({
        subjectExamBoardId: "board-1",
        expectedExamBoardId: "board-2",
      }),
    ).toThrow("Subject does not belong to the selected exam board");
  });
});

describe("isQualificationConsistentWithSubject", () => {
  it("returns true when stored and subject qualification match", () => {
    expect(
      isQualificationConsistentWithSubject({
        storedQualificationId: "q1",
        subjectQualificationId: "q1",
      }),
    ).toBe(true);
  });

  it("returns false on mismatch", () => {
    expect(
      isQualificationConsistentWithSubject({
        storedQualificationId: "q-old",
        subjectQualificationId: "q-new",
      }),
    ).toBe(false);
  });
});
