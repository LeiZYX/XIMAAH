import { describe, expect, it } from "vitest";
import {
  enrichBatchFromStudentRequest,
  legacyConcatenatedAdjustmentReason,
  scoreStudentRequestBatchMatch,
} from "@/lib/registrations/backfill-student-adjustment-history";
import type { AdjustmentHistoryBatch } from "@/lib/registrations/adjustment-history";

function sampleBatch(overrides: Partial<AdjustmentHistoryBatch> = {}): AdjustmentHistoryBatch {
  return {
    adjustedAt: "2026-09-15T10:58:22.000Z",
    adjustedByName: "Exam Officer",
    adjustedByRole: "EXAM_OFFICER",
    reason: "approve · Teacher approval: approve",
    added: [
      {
        subject: "Chemistry",
        paperCode: "WCH12/01",
        paperTitle: "Unit 2",
      },
    ],
    removed: [],
    replaced: [],
    requestedByName: "Physics Teacher",
    requestedByRole: "SUBJECT_TEACHER",
    ...overrides,
  };
}

describe("backfill student adjustment history helpers", () => {
  it("builds the legacy concatenated reason", () => {
    expect(legacyConcatenatedAdjustmentReason("approve", "approve")).toBe(
      "approve · Teacher approval: approve",
    );
  });

  it("scores a legacy student-flow batch highly", () => {
    const score = scoreStudentRequestBatchMatch({
      batch: sampleBatch(),
      eoReviewedAt: new Date("2026-09-15T10:58:22.000Z"),
      eoReason: "approve",
      teacherReason: "approve",
      requestPaperCodes: new Set(["WCH12/01"]),
    });
    expect(score).toBeGreaterThanOrEqual(40);
  });

  it("rejects batches outside the time window", () => {
    const score = scoreStudentRequestBatchMatch({
      batch: sampleBatch({ adjustedAt: "2026-09-01T00:00:00.000Z" }),
      eoReviewedAt: new Date("2026-09-15T10:58:22.000Z"),
      eoReason: "approve",
      teacherReason: "approve",
      requestPaperCodes: new Set(["WCH12/01"]),
    });
    expect(score).toBe(-1);
  });

  it("enriches a batch as a student request", () => {
    const enriched = enrichBatchFromStudentRequest(sampleBatch(), {
      studentReasons: [
        {
          itemType: "ADD",
          label: "Chemistry — WCH12/01 Unit 2",
          reason: "Need chemistry unit",
        },
      ],
      teacherApproval: {
        decision: "Approved",
        reason: "approve",
        byName: "Physics Teacher",
        byRole: "SUBJECT_TEACHER",
        at: "2026-09-15T10:50:00.000Z",
      },
      eoApproval: {
        decision: "Approved",
        reason: "approve",
        byName: "Exam Officer",
        byRole: "EXAM_OFFICER",
        at: "2026-09-15T10:58:22.000Z",
      },
      eoReason: "approve",
      teacherName: "Physics Teacher",
      teacherRole: "SUBJECT_TEACHER",
    });

    expect(enriched.source).toBe("STUDENT_REQUEST");
    expect(enriched.reason).toBe("approve");
    expect(enriched.studentReasons?.[0]?.reason).toBe("Need chemistry unit");
    expect(enriched.teacherApproval?.byName).toBe("Physics Teacher");
    expect(enriched.eoApproval?.decision).toBe("Approved");
  });
});
