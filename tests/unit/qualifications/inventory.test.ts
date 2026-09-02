import { describe, expect, it } from "vitest";
import {
  formatQualificationInventoryReport,
  isSyllabusStyleQualification,
  summarizeBoardQualifications,
  type QualificationInventoryReport,
} from "@/lib/qualifications/inventory";

describe("isSyllabusStyleQualification", () => {
  it("detects 1-subject qualifications where subject code equals qualification code", () => {
    expect(
      isSyllabusStyleQualification({
        qualificationId: "q1",
        qualificationCode: "9BI0",
        subjectCount: 1,
        soleSubjectCode: "9BI0",
      }),
    ).toBe(true);
  });

  it("returns false for multi-subject qualifications", () => {
    expect(
      isSyllabusStyleQualification({
        qualificationId: "q1",
        qualificationCode: "A",
        subjectCount: 2,
        soleSubjectCode: null,
      }),
    ).toBe(false);
  });

  it("returns false when codes differ", () => {
    expect(
      isSyllabusStyleQualification({
        qualificationId: "q1",
        qualificationCode: "9BI0",
        subjectCount: 1,
        soleSubjectCode: "9CH0",
      }),
    ).toBe(false);
  });
});

describe("summarizeBoardQualifications", () => {
  it("aggregates per-board qualification structure counts", () => {
    const summary = summarizeBoardQualifications({
      examBoardId: "board-1",
      examBoardCode: "EDEXCEL",
      examBoardName: "Edexcel",
      subjectCount: 3,
      qualifications: [
        { id: "q1", code: "9BI0", subjectCount: 1, soleSubjectCode: "9BI0" },
        { id: "q2", code: "9CH0", subjectCount: 1, soleSubjectCode: "9CH0" },
        { id: "q3", code: "ALEVEL", subjectCount: 0, soleSubjectCode: null },
      ],
    });

    expect(summary).toEqual({
      examBoardId: "board-1",
      examBoardCode: "EDEXCEL",
      examBoardName: "Edexcel",
      qualificationCount: 3,
      subjectCount: 3,
      singleSubjectQualificationCount: 2,
      syllabusStyleQualificationCount: 2,
      orphanQualificationCount: 1,
    });
  });
});

describe("formatQualificationInventoryReport", () => {
  it("includes board summary and FK mismatch section", () => {
    const report: QualificationInventoryReport = {
      generatedAt: "2026-09-02T00:00:00.000Z",
      boardSummaries: [
        {
          examBoardId: "b1",
          examBoardCode: "EDEXCEL",
          examBoardName: "Edexcel",
          qualificationCount: 2,
          subjectCount: 2,
          singleSubjectQualificationCount: 2,
          syllabusStyleQualificationCount: 2,
          orphanQualificationCount: 0,
        },
      ],
      issues: [
        {
          kind: "FK_MISMATCH",
          entity: "CashInCode",
          entityId: "cic-1",
          examBoardCode: "EDEXCEL",
          message: "CashInCode qualificationId does not match subject.qualificationId",
          details: {
            storedQualificationId: "q-old",
            subjectQualificationId: "q-new",
            subjectId: "s1",
            subjectCode: "9BI0",
          },
        },
      ],
      totals: {
        qualifications: 2,
        subjects: 2,
        issueCount: 1,
        fkMismatchCount: 1,
        orphanQualificationCount: 0,
        syllabusStyleQualificationCount: 2,
      },
    };

    const text = formatQualificationInventoryReport(report);
    expect(text).toContain("EDEXCEL");
    expect(text).toContain("FK mismatches");
    expect(text).toContain("CashInCode cic-1");
  });

  it("reports clean state when no FK mismatches exist", () => {
    const report: QualificationInventoryReport = {
      generatedAt: "2026-09-02T00:00:00.000Z",
      boardSummaries: [],
      issues: [],
      totals: {
        qualifications: 0,
        subjects: 0,
        issueCount: 0,
        fkMismatchCount: 0,
        orphanQualificationCount: 0,
        syllabusStyleQualificationCount: 0,
      },
    };

    expect(formatQualificationInventoryReport(report)).toContain("No FK mismatches detected.");
  });
});
