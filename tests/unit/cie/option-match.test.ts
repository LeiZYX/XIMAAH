import { describe, expect, it } from "vitest";
import {
  componentSetsEqual,
  matchOptionForComponents,
  normalizeComponentCode,
} from "@/lib/cie/option-match";

describe("normalizeComponentCode", () => {
  it("strips syllabus prefixes", () => {
    expect(normalizeComponentCode("0452/12")).toBe("12");
    expect(normalizeComponentCode("0452_02")).toBe("02");
    expect(normalizeComponentCode("12")).toBe("12");
  });
});

describe("matchOptionForComponents", () => {
  const options = [
    { syllabusCode: "0452", optionCode: "AY", componentCodes: ["12", "02"] },
    { syllabusCode: "0452", optionCode: "AZ", componentCodes: ["12", "22"] },
  ];

  it("matches exact option", () => {
    const result = matchOptionForComponents(options, ["02", "12"]);
    expect(result.status).toBe("exact");
    if (result.status === "exact") {
      expect(result.option.optionCode).toBe("AY");
    }
  });

  it("reports missing components", () => {
    const result = matchOptionForComponents(options, ["12"]);
    expect(result.status).toBe("partial");
    if (result.status !== "exact") {
      expect(result.missing).toContain("02");
    }
  });

  it("reports extras", () => {
    const result = matchOptionForComponents(options, ["12", "02", "22"]);
    expect(result.status === "extra" || result.status === "partial").toBe(true);
  });
});

describe("componentSetsEqual", () => {
  it("ignores order and prefixes", () => {
    expect(componentSetsEqual(["0452/12", "02"], ["02", "12"])).toBe(true);
  });
});
