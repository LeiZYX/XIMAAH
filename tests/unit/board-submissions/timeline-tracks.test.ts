import { describe, expect, it } from "vitest";
import {
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
