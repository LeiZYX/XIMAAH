import { describe, expect, it } from "vitest";
import {
  buildLevelNormalizePlan,
  normalizeQualificationLevel,
} from "@/lib/qualifications/normalize-level";

describe("normalizeQualificationLevel", () => {
  it("collapses hyphen and underscore variants", () => {
    expect(normalizeQualificationLevel("A-Level")).toBe("A Level");
    expect(normalizeQualificationLevel("A_Level")).toBe("A Level");
    expect(normalizeQualificationLevel("  A   Level  ")).toBe("A Level");
  });
});

describe("buildLevelNormalizePlan", () => {
  it("merges A-Level into A Level on the same board", () => {
    const plan = buildLevelNormalizePlan([
      {
        id: "q-space",
        examBoardId: "aqa",
        examBoardCode: "AQA",
        level: "A Level",
        name: "A Level",
        code: null,
        subjectIds: ["s1", "s2"],
        subjectCodes: ["7401", "7402"],
      },
      {
        id: "q-hyphen",
        examBoardId: "aqa",
        examBoardCode: "AQA",
        level: "A-Level",
        name: "A-Level Biology",
        code: null,
        subjectIds: ["s3"],
        subjectCodes: ["7405"],
      },
    ]);

    expect(plan.collisions).toEqual([]);
    expect(plan.totals.merges).toBe(1);
    expect(plan.actions.some((action) => action.kind === "merge")).toBe(true);
    const merge = plan.actions.find((action) => action.kind === "merge");
    expect(merge).toMatchObject({
      targetQualificationId: "q-space",
      targetLevel: "A Level",
      sourceQualificationIds: ["q-hyphen"],
      subjectIdsToMove: ["s3"],
    });
  });

  it("renames a lone hyphenated level", () => {
    const plan = buildLevelNormalizePlan([
      {
        id: "q1",
        examBoardId: "aqa",
        examBoardCode: "AQA",
        level: "A-Level",
        name: "A-Level",
        code: null,
        subjectIds: ["s1"],
        subjectCodes: ["7405"],
      },
    ]);

    expect(plan.actions).toEqual([
      {
        kind: "rename",
        examBoardCode: "AQA",
        qualificationId: "q1",
        fromLevel: "A-Level",
        toLevel: "A Level",
        subjectCount: 1,
      },
    ]);
  });

  it("does nothing when already canonical", () => {
    const plan = buildLevelNormalizePlan([
      {
        id: "q1",
        examBoardId: "aqa",
        examBoardCode: "AQA",
        level: "A Level",
        name: "A Level",
        code: null,
        subjectIds: ["s1"],
        subjectCodes: ["7401"],
      },
    ]);
    expect(plan.actions).toEqual([]);
  });
});
