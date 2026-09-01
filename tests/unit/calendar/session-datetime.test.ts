import { describe, expect, it } from "vitest";
import {
  examSessionCalendarDateKey,
  examSessionCalendarEnd,
  examSessionCalendarStart,
} from "@/lib/calendar/session-datetime";

describe("examSessionCalendarStart", () => {
  it("uses the stored calendar date without timezone shift", () => {
    const date = new Date("2026-06-08T00:00:00.000Z");
    expect(examSessionCalendarDateKey(date)).toBe("2026-06-08");
    expect(examSessionCalendarStart(date, "09:00")).toBe("2026-06-08T09:00:00");
    expect(examSessionCalendarEnd(date, "09:00", "17:00")).toBe("2026-06-08T17:00:00");
  });

  it("returns a date-only value when no start time is provided", () => {
    const date = new Date("2026-06-08T00:00:00.000Z");
    expect(examSessionCalendarStart(date, null)).toBe("2026-06-08");
    expect(examSessionCalendarEnd(date, null, null)).toBeUndefined();
  });
});
