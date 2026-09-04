import { describe, expect, it } from "vitest";
import { parseStudentOverviewFilters } from "@/lib/students/overview";

describe("parseStudentOverviewFilters", () => {
  it("defaults to internal active students", () => {
    const filters = parseStudentOverviewFilters(new URLSearchParams());
    expect(filters).toEqual({
      candidateType: "INTERNAL",
      status: "ACTIVE",
      grade: undefined,
      q: undefined,
    });
  });

  it("parses grade and unassigned", () => {
    expect(parseStudentOverviewFilters(new URLSearchParams("grade=G11")).grade).toBe("G11");
    expect(
      parseStudentOverviewFilters(new URLSearchParams("grade=UNASSIGNED")).grade,
    ).toBe("UNASSIGNED");
    expect(parseStudentOverviewFilters(new URLSearchParams("grade=ALL")).grade).toBeUndefined();
  });
});
