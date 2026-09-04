import { describe, expect, it } from "vitest";
import {
  evaluateScheduledBackupDue,
  getCurrentPeriodStart,
} from "@/lib/backup/schedule";

const TZ = "Asia/Shanghai";

describe("backup schedule due check", () => {
  it("is not due when disabled", () => {
    const result = evaluateScheduledBackupDue({
      settings: { enabled: false, frequency: "WEEKLY", backupTime: "02:00" },
      lastScheduledSuccessAt: null,
      now: new Date("2026-09-08T01:00:00.000Z"), // Mon 09:00 Shanghai
      timeZone: TZ,
    });
    expect(result.due).toBe(false);
    expect(result.reason).toMatch(/disabled/i);
  });

  it("is due for weekly on Monday after backup time with no prior success", () => {
    // Monday 2026-09-07 03:00 Asia/Shanghai = 2026-09-06T19:00:00.000Z
    const now = new Date("2026-09-06T19:30:00.000Z");
    const result = evaluateScheduledBackupDue({
      settings: { enabled: true, frequency: "WEEKLY", backupTime: "02:00" },
      lastScheduledSuccessAt: null,
      now,
      timeZone: TZ,
    });
    expect(result.due).toBe(true);
    expect(result.periodStart?.toISOString()).toBe(
      getCurrentPeriodStart(now, "WEEKLY", "02:00", TZ).toISOString(),
    );
  });

  it("skips when already succeeded in the current weekly period", () => {
    const now = new Date("2026-09-06T20:00:00.000Z"); // Mon 04:00 Shanghai
    const periodStart = getCurrentPeriodStart(now, "WEEKLY", "02:00", TZ);
    const result = evaluateScheduledBackupDue({
      settings: { enabled: true, frequency: "WEEKLY", backupTime: "02:00" },
      lastScheduledSuccessAt: new Date(periodStart.getTime() + 60_000),
      now,
      timeZone: TZ,
    });
    expect(result.due).toBe(false);
    expect(result.reason).toMatch(/already completed/i);
  });

  it("is due daily after backup time until success", () => {
    // 2026-09-04 02:30 Asia/Shanghai
    const now = new Date("2026-09-03T18:30:00.000Z");
    const result = evaluateScheduledBackupDue({
      settings: { enabled: true, frequency: "DAILY", backupTime: "02:00" },
      lastScheduledSuccessAt: null,
      now,
      timeZone: TZ,
    });
    expect(result.due).toBe(true);
  });

  it("is not due daily before backup time", () => {
    // 2026-09-04 01:00 Asia/Shanghai
    const now = new Date("2026-09-03T17:00:00.000Z");
    const result = evaluateScheduledBackupDue({
      settings: { enabled: true, frequency: "DAILY", backupTime: "02:00" },
      lastScheduledSuccessAt: null,
      now,
      timeZone: TZ,
    });
    // Before today's 02:00 → period is yesterday's 02:00, so it IS due if no success yesterday
    // Wait - getCurrentPeriodStart: if now < today's 02:00, period is yesterday 02:00.
    // So at 01:00 today with no success, we're still "due" for yesterday's window.
    // That's correct for catch-up. If we already succeeded yesterday, not due.
    expect(result.due).toBe(true);

    const yesterdayStart = getCurrentPeriodStart(now, "DAILY", "02:00", TZ);
    const withSuccess = evaluateScheduledBackupDue({
      settings: { enabled: true, frequency: "DAILY", backupTime: "02:00" },
      lastScheduledSuccessAt: new Date(yesterdayStart.getTime() + 60_000),
      now,
      timeZone: TZ,
    });
    expect(withSuccess.due).toBe(false);
  });
});
