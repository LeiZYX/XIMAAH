import { describe, expect, it } from "vitest";
import {
  formatRegistrationTypes,
  resolveBulkEntriesDemographics,
} from "@/lib/board-submissions/bulk-entries/identity";

describe("resolveBulkEntriesDemographics", () => {
  it("falls back to student profile gender when candidate gender is missing", () => {
    const result = resolveBulkEntriesDemographics({
      gender: null,
      dateOfBirth: new Date("2010-05-15T00:00:00.000Z"),
      user: { studentProfile: { gender: "FEMALE" } },
    });

    expect(result.gender).toBe("FEMALE");
    expect(result.dateOfBirth).toEqual(new Date("2010-05-15T00:00:00.000Z"));
  });

  it("prefers candidate gender over student profile", () => {
    const result = resolveBulkEntriesDemographics({
      gender: "MALE",
      dateOfBirth: null,
      user: { studentProfile: { gender: "FEMALE" } },
    });

    expect(result.gender).toBe("MALE");
    expect(result.dateOfBirth).toBeNull();
  });
});

describe("formatRegistrationTypes", () => {
  it("labels unique registration types", () => {
    expect(
      formatRegistrationTypes(["INTERNAL_NORMAL", "RESTRICTED_INTERNAL", "INTERNAL_NORMAL"]),
    ).toBe("Internal, Restricted");
  });
});
