import { describe, expect, it } from "vitest";
import {
  formatAcademicYear,
  getAcademicYearForDate,
  inferAcademicYearFromExamYear,
  isValidAcademicYear,
  parseAcademicYear,
} from "@/lib/registrations/academic-year";

describe("academic-year", () => {
  it("formats academic year labels", () => {
    expect(formatAcademicYear(2026)).toBe("2026/27");
    expect(formatAcademicYear(2025)).toBe("2025/26");
  });

  it("parses valid academic years", () => {
    expect(parseAcademicYear("2026/27")).toEqual({ startYear: 2026, endYear: 2027 });
    expect(parseAcademicYear("invalid")).toBeNull();
  });

  it("maps exam calendar years to academic years", () => {
    expect(inferAcademicYearFromExamYear(2027)).toBe("2026/27");
    expect(inferAcademicYearFromExamYear(2026)).toBe("2025/26");
  });

  it("uses September boundary for registration dates", () => {
    expect(getAcademicYearForDate(new Date("2027-06-15T00:00:00Z"))).toBe("2026/27");
    expect(getAcademicYearForDate(new Date("2027-09-01T00:00:00Z"))).toBe("2027/28");
  });

  it("validates academic year strings", () => {
    expect(isValidAcademicYear("2026/27")).toBe(true);
    expect(isValidAcademicYear("2026-27")).toBe(false);
  });
});
