import { describe, expect, it } from "vitest";
import {
  canConfigureSubjectTeacherConfirmation,
  isCieExamBoard,
  isEdexcelExamBoard,
  resolveExamBoardBranch,
  usesCieEntries,
  usesPearsonBulkEntries,
} from "@/lib/exam-boards/branch";

describe("exam board branch", () => {
  it("classifies CIE / Cambridge as CIE", () => {
    expect(isCieExamBoard("CIE")).toBe(true);
    expect(isCieExamBoard("CAMBRIDGE")).toBe(true);
    expect(isCieExamBoard("X", "Cambridge International")).toBe(true);
    expect(resolveExamBoardBranch("CIE")).toBe("CIE");
    expect(usesCieEntries("CIE")).toBe(true);
    expect(usesPearsonBulkEntries("CIE")).toBe(false);
    expect(canConfigureSubjectTeacherConfirmation("CIE")).toBe(true);
  });

  it("classifies Edexcel / Pearson as Edexcel bulk channel", () => {
    expect(isEdexcelExamBoard("EDEXCEL")).toBe(true);
    expect(isEdexcelExamBoard("PEARSON")).toBe(true);
    expect(usesPearsonBulkEntries("EDEXCEL")).toBe(true);
    expect(usesCieEntries("EDEXCEL")).toBe(false);
    expect(canConfigureSubjectTeacherConfirmation("EDEXCEL")).toBe(false);
  });

  it("does not enable CIE switches for AQA", () => {
    expect(resolveExamBoardBranch("AQA")).toBe("AQA");
    expect(canConfigureSubjectTeacherConfirmation("AQA")).toBe(false);
    expect(usesCieEntries("AQA")).toBe(false);
  });
});
