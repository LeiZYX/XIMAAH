import { describe, expect, it } from "vitest";
import {
  buildBoardSubmissionMilestones,
  buildBoardSubmissionTimeline,
  splitTimelineTracks,
} from "@/lib/board-submissions/timeline";

describe("splitTimelineTracks", () => {
  it("separates permission and fee segments that share the same dates", () => {
    const open = new Date("2026-09-01T00:00:00.000Z");
    const studentClose = new Date("2026-09-05T00:00:00.000Z");
    const regClose = new Date("2026-09-12T07:00:00.000Z");
    const now = new Date("2026-09-03T00:00:00.000Z");

    const segments = buildBoardSubmissionTimeline(
      {
        studentRegistrationOpenAt: open,
        studentRegistrationCloseAt: studentClose,
        registrationCloseAt: regClose,
        status: "OPEN",
      },
      [
        {
          id: "n1",
          registrationWindowId: "w1",
          stageCode: "NORMAL",
          stageName: "Normal",
          sequence: 1,
          enabled: true,
          startAt: open,
          endAt: studentClose,
          notes: null,
        },
      ],
      now,
    );

    const { permission, fee } = splitTimelineTracks(segments);
    expect(permission.map((s) => s.kind)).toEqual([
      "STUDENT_OPEN",
      "EO_ADJUSTMENT",
      "WINDOW_CLOSED",
    ]);
    expect(fee.map((s) => s.kind)).toEqual(["NORMAL"]);
    expect(fee[0]?.startAt).toBe(permission[0]?.startAt);
    expect(fee[0]?.endAt).toBe(permission[0]?.endAt);
  });
});

describe("buildBoardSubmissionMilestones", () => {
  it("adds student adjustment request close when enabled", () => {
    const milestones = buildBoardSubmissionMilestones(
      {
        status: "OPEN",
        studentRegistrationOpenAt: new Date("2026-09-04T07:20:00.000Z"),
        studentRegistrationCloseAt: new Date("2026-09-10T07:21:00.000Z"),
        registrationCloseAt: new Date("2026-09-20T07:21:00.000Z"),
        studentAdjustmentRequestEnabled: true,
        studentAdjustmentRequestCloseAt: new Date("2026-09-18T00:00:00.000Z"),
      },
      new Date("2026-09-12T00:00:00.000Z"),
    );
    expect(milestones).toHaveLength(1);
    expect(milestones[0]?.kind).toBe("STUDENT_ADJUSTMENT_REQUEST_CLOSE");
    expect(milestones[0]?.at).toBe("2026-09-18T00:00:00.000Z");
    expect(milestones[0]?.isPast).toBe(false);
  });

  it("omits the milestone when student late adjustment is disabled", () => {
    const milestones = buildBoardSubmissionMilestones(
      {
        status: "OPEN",
        studentRegistrationOpenAt: new Date("2026-09-04T07:20:00.000Z"),
        studentRegistrationCloseAt: new Date("2026-09-10T07:21:00.000Z"),
        registrationCloseAt: new Date("2026-09-20T07:21:00.000Z"),
        studentAdjustmentRequestEnabled: false,
        studentAdjustmentRequestCloseAt: new Date("2026-09-18T00:00:00.000Z"),
      },
      new Date("2026-09-12T00:00:00.000Z"),
    );
    expect(milestones).toEqual([]);
  });
});
