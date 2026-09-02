import { describe, expect, it } from "vitest";
import { parseChineseIdCardDemographics } from "@/lib/candidates/chinese-id-card";
import {
  formatRegistrationTypes,
  resolveBulkEntriesDemographics,
} from "@/lib/board-submissions/bulk-entries/identity";

describe("parseChineseIdCardDemographics", () => {
  it("derives gender and date of birth from an 18-digit ID card", () => {
    const result = parseChineseIdCardDemographics("110101201001011234");

    expect(result.gender).toBe("MALE");
    expect(result.dateOfBirth).toEqual(new Date("2010-01-01T00:00:00.000Z"));
  });
});

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

  it("reads gender and date of birth from linked student profile on the workspace", () => {
    const result = resolveBulkEntriesDemographics({
      gender: null,
      dateOfBirth: null,
      studentProfile: {
        gender: null,
        idCardNumber: "110101201001011234",
      },
    });

    expect(result.gender).toBe("MALE");
    expect(result.dateOfBirth).toEqual(new Date("2010-01-01T00:00:00.000Z"));
  });

  it("derives demographics from candidate ID number when explicit fields are empty", () => {
    const result = resolveBulkEntriesDemographics({
      gender: null,
      dateOfBirth: null,
      idNumber: "110101201002021236",
    });

    expect(result.gender).toBe("FEMALE");
    expect(result.dateOfBirth).toEqual(new Date("2010-02-02T00:00:00.000Z"));
  });
});

describe("formatRegistrationTypes", () => {
  it("labels unique registration types", () => {
    expect(
      formatRegistrationTypes(["INTERNAL_NORMAL", "RESTRICTED_INTERNAL", "INTERNAL_NORMAL"]),
    ).toBe("Internal, Restricted");
  });
});
