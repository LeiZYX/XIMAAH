import { describe, expect, it } from "vitest";
import {
  buildQualificationMergePlan,
  findSubjectCodeCollisions,
  pickCanonicalTarget,
  type MergeQualificationInput,
} from "@/lib/qualifications/merge-plan";

function qual(
  overrides: Partial<MergeQualificationInput> & Pick<MergeQualificationInput, "id">,
): MergeQualificationInput {
  return {
    examBoardId: "board-1",
    examBoardCode: "EDEXCEL",
    level: "GCE A Level",
    name: "GCE A Level Biology",
    code: "9BI0",
    subjectIds: ["s-bi"],
    subjectCodes: ["9BI0"],
    ...overrides,
  };
}

describe("pickCanonicalTarget", () => {
  it("prefers an existing code=null qualification", () => {
    const result = pickCanonicalTarget([
      qual({ id: "q-syllabus", code: "9BI0" }),
      qual({
        id: "q-level",
        code: null,
        name: "GCE A Level",
        subjectIds: [],
        subjectCodes: [],
      }),
    ]);
    expect(result.createTarget).toBe(false);
    expect(result.target?.id).toBe("q-level");
  });

  it("requests create when no canonical exists", () => {
    const result = pickCanonicalTarget([
      qual({ id: "q1", code: "9BI0" }),
      qual({ id: "q2", code: "9CH0", subjectIds: ["s-ch"], subjectCodes: ["9CH0"] }),
    ]);
    expect(result.createTarget).toBe(true);
    expect(result.target).toBeNull();
    expect(result.targetName).toBe("GCE A Level");
  });
});

describe("findSubjectCodeCollisions", () => {
  it("detects duplicate subject codes across qualifications", () => {
    const collisions = findSubjectCodeCollisions([
      qual({ id: "q1", subjectIds: ["s1"], subjectCodes: ["9BI0"] }),
      qual({ id: "q2", code: "X", subjectIds: ["s2"], subjectCodes: ["9BI0"] }),
    ]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]?.subjectCode).toBe("9BI0");
    expect(collisions[0]?.subjectIds).toEqual(["s1", "s2"]);
  });

  it("allows the same subject listed once", () => {
    expect(
      findSubjectCodeCollisions([
        qual({ id: "q1", subjectIds: ["s1"], subjectCodes: ["9BI0"] }),
        qual({
          id: "q2",
          code: null,
          subjectIds: ["s-ch"],
          subjectCodes: ["9CH0"],
        }),
      ]),
    ).toEqual([]);
  });
});

describe("buildQualificationMergePlan", () => {
  it("merges syllabus-style quals into one level target", () => {
    const plan = buildQualificationMergePlan([
      qual({ id: "q-bio", code: "9BI0", subjectIds: ["s-bi"], subjectCodes: ["9BI0"] }),
      qual({ id: "q-chem", code: "9CH0", subjectIds: ["s-ch"], subjectCodes: ["9CH0"] }),
    ]);

    expect(plan.collisions).toEqual([]);
    expect(plan.mappings).toHaveLength(1);
    expect(plan.mappings[0]).toMatchObject({
      level: "GCE A Level",
      createTarget: true,
      subjectIdsToMove: expect.arrayContaining(["s-bi", "s-ch"]),
    });
    expect(plan.mappings[0]?.sourceQualificationIds).toEqual(["q-bio", "q-chem"]);
  });

  it("moves sources onto an existing canonical qualification", () => {
    const plan = buildQualificationMergePlan([
      qual({
        id: "q-level",
        code: null,
        name: "GCE A Level",
        subjectIds: ["s-existing"],
        subjectCodes: ["EXIST"],
      }),
      qual({ id: "q-bio", code: "9BI0", subjectIds: ["s-bi"], subjectCodes: ["9BI0"] }),
    ]);

    expect(plan.mappings).toHaveLength(1);
    expect(plan.mappings[0]).toMatchObject({
      createTarget: false,
      targetQualificationId: "q-level",
      sourceQualificationIds: ["q-bio"],
      subjectIdsToMove: ["s-bi"],
    });
  });

  it("skips levels that are already a single canonical qualification", () => {
    const plan = buildQualificationMergePlan([
      qual({
        id: "q-level",
        code: null,
        name: "GCE A Level",
        subjectIds: ["s1", "s2"],
        subjectCodes: ["A", "B"],
      }),
    ]);
    expect(plan.mappings).toEqual([]);
    expect(plan.alreadyCanonical).toBe(1);
  });

  it("groups by board and level independently", () => {
    const plan = buildQualificationMergePlan([
      qual({ id: "e1", code: "9BI0" }),
      qual({ id: "e2", code: "9CH0", subjectIds: ["s-ch"], subjectCodes: ["9CH0"] }),
      qual({
        id: "a1",
        examBoardId: "board-aqa",
        examBoardCode: "AQA",
        level: "A-level",
        code: "7402",
        subjectIds: ["s-aqa"],
        subjectCodes: ["7402"],
      }),
    ]);

    expect(plan.totals.levelsToMerge).toBe(2);
    expect(plan.totals.boards).toBe(2);
  });
});
