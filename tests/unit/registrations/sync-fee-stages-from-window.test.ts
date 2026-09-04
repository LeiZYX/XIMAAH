import { describe, expect, it } from "vitest";
import {
  applyWindowTimingToFeeStage,
  isFeeStageFieldBoundByWindow,
} from "@/lib/registrations/sync-fee-stages-from-window";
import { assertFeeStageDatesValid } from "@/lib/registrations/fee-stages";

const window = {
  studentRegistrationOpenAt: new Date("2026-09-01T00:00:00.000Z"),
  studentRegistrationCloseAt: new Date("2026-09-10T00:00:00.000Z"),
  registrationCloseAt: new Date("2026-09-20T00:00:00.000Z"),
};

describe("applyWindowTimingToFeeStage", () => {
  it("binds Normal start but keeps a custom end on/after student close", () => {
    const customEnd = new Date("2026-09-12T00:00:00.000Z");
    const result = applyWindowTimingToFeeStage(
      {
        stageCode: "NORMAL" as const,
        startAt: new Date("2026-08-01T00:00:00.000Z"),
        endAt: customEnd,
      },
      window,
    );

    expect(result.startAt).toEqual(window.studentRegistrationOpenAt);
    expect(result.endAt).toEqual(customEnd);
  });

  it("defaults empty Normal end to student registration close", () => {
    const result = applyWindowTimingToFeeStage(
      {
        stageCode: "NORMAL" as const,
        startAt: "",
        endAt: "",
      },
      window,
    );

    expect(result.startAt).toEqual(window.studentRegistrationOpenAt);
    expect(result.endAt).toEqual(window.studentRegistrationCloseAt);
  });
});

describe("isFeeStageFieldBoundByWindow", () => {
  it("only locks Normal start and High Late end", () => {
    expect(isFeeStageFieldBoundByWindow("NORMAL", "startAt")).toBe(true);
    expect(isFeeStageFieldBoundByWindow("NORMAL", "endAt")).toBe(false);
    expect(isFeeStageFieldBoundByWindow("HIGH_LATE", "endAt")).toBe(true);
    expect(isFeeStageFieldBoundByWindow("LATE", "endAt")).toBe(false);
  });
});

describe("assertFeeStageDatesValid Normal end", () => {
  it("rejects Normal end before student registration close", () => {
    expect(() =>
      assertFeeStageDatesValid(
        [
          {
            stageCode: "NORMAL",
            startAt: window.studentRegistrationOpenAt,
            endAt: new Date("2026-09-09T00:00:00.000Z"),
            enabled: true,
          },
        ],
        window,
      ),
    ).toThrow(/on or after Student registration close/);
  });

  it("allows Normal end equal to student registration close", () => {
    expect(() =>
      assertFeeStageDatesValid(
        [
          {
            stageCode: "NORMAL",
            startAt: window.studentRegistrationOpenAt,
            endAt: window.studentRegistrationCloseAt,
            enabled: true,
          },
        ],
        window,
      ),
    ).not.toThrow();
  });
});
