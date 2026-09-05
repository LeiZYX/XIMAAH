import { describe, expect, it } from "vitest";
import {
  classifyUciNumber,
  deriveInternalProvisionalUci,
  examBoardUsesEdexcelUciRules,
  isValidConfirmedUciFormat,
  isValidProvisionalUciFormat,
  needsCandidateRegistrationFeeForUci,
} from "@/lib/candidates/uci-allocation";

describe("classifyUciNumber", () => {
  it("classifies empty, provisional, and confirmed shapes", () => {
    expect(classifyUciNumber(null)).toBe("EMPTY");
    expect(classifyUciNumber("")).toBe("EMPTY");
    expect(classifyUciNumber("96834B250233")).toBe("PROVISIONAL_OR_LEGACY");
    expect(classifyUciNumber("96834B250233X")).toBe("CONFIRMED");
  });
});

describe("needsCandidateRegistrationFeeForUci", () => {
  it("requires fee when empty or without trailing letter", () => {
    expect(needsCandidateRegistrationFeeForUci(null)).toBe(true);
    expect(needsCandidateRegistrationFeeForUci("96834B250233")).toBe(true);
    expect(needsCandidateRegistrationFeeForUci("96834B250233X")).toBe(false);
  });
});

describe("deriveInternalProvisionalUci", () => {
  it("builds Centre + B + last six of school number", () => {
    expect(deriveInternalProvisionalUci("96834", "XM250233")).toBe("96834B250233");
  });

  it("rejects short or non-digit suffixes", () => {
    expect(() => deriveInternalProvisionalUci("96834", "XM25")).toThrow(/at least 6/);
    expect(() => deriveInternalProvisionalUci("96834", "XM25AB")).toThrow(/digits/);
    expect(() => deriveInternalProvisionalUci("", "XM250233")).toThrow(/Centre Number/);
  });
});

describe("examBoardUsesEdexcelUciRules", () => {
  it("recognizes Pearson / Edexcel boards", () => {
    expect(examBoardUsesEdexcelUciRules("EDEXCEL")).toBe(true);
    expect(examBoardUsesEdexcelUciRules("PEARSON")).toBe(true);
    expect(examBoardUsesEdexcelUciRules("AQA")).toBe(false);
  });
});

describe("UCI format helpers", () => {
  it("validates provisional and confirmed formats", () => {
    expect(isValidProvisionalUciFormat("96834B250233", "96834")).toBe(true);
    expect(isValidProvisionalUciFormat("96834B250233X", "96834")).toBe(false);
    expect(isValidConfirmedUciFormat("96834B250233X", "96834")).toBe(true);
  });
});
