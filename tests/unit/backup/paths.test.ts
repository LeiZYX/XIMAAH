import { describe, expect, it } from "vitest";
import {
  buildBackupFileName,
  isAllowedBackupDirectory,
  isValidBackupTime,
  normalizeBackupDirectory,
  sanitizeBackupFileName,
} from "@/lib/backup/paths";

describe("backup paths", () => {
  it("validates backup time", () => {
    expect(isValidBackupTime("02:00")).toBe(true);
    expect(isValidBackupTime("23:59")).toBe(true);
    expect(isValidBackupTime("24:00")).toBe(false);
    expect(isValidBackupTime("9:00")).toBe(false);
  });

  it("allows production backup directories", () => {
    expect(isAllowedBackupDirectory("/var/backups/xima-assessment-hub")).toBe(true);
  });

  it("builds backup file names", () => {
    const name = buildBackupFileName(new Date("2026-07-02T14:30:45"));
    expect(name).toBe("xima_assessment_hub_backup_20260702_143045.sql.gz");
    expect(sanitizeBackupFileName(name)).toBe(name);
  });

  it("rejects unsafe directories in production mode", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    expect(() => normalizeBackupDirectory("/tmp/backups")).toThrow();
    process.env.NODE_ENV = original;
  });
});
