import { describe, expect, it } from "vitest";
import { findMatchingFeeRuleWithFallback } from "@/lib/fees/match";
import type { FeeRuleRecord } from "@/lib/fees/types";

function baseRule(overrides: Partial<FeeRuleRecord> = {}): FeeRuleRecord {
  return {
    id: "rule-1",
    registrationWindowId: "window-1",
    examBoardId: "board-1",
    examSeriesId: "series-1",
    qualificationId: "qual-1",
    subjectId: "subject-1",
    paperId: null,
    examSessionId: null,
    entryType: "NORMAL",
    costCurrency: "GBP",
    costAmount: 100,
    exchangeRateToCny: null,
    markupType: "PERCENTAGE",
    markupValue: 10,
    salesCurrency: "GBP",
    salesAmount: null,
    isActive: true,
    ...overrides,
  };
}

const ctx = {
  examBoardId: "board-1",
  examSeriesId: "series-1",
  qualificationId: "qual-1",
  subjectId: "subject-1",
  paperId: null,
  examSessionId: null,
};

describe("findMatchingFeeRuleWithFallback", () => {
  it("uses the normal rule when no late rule exists", () => {
    const rules = [baseRule({ id: "normal", entryType: "NORMAL" })];
    const match = findMatchingFeeRuleWithFallback(rules, { ...ctx, entryType: "LATE" });
    expect(match?.id).toBe("normal");
  });

  it("prefers the late rule when configured", () => {
    const rules = [
      baseRule({ id: "normal", entryType: "NORMAL" }),
      baseRule({ id: "late", entryType: "LATE", costAmount: 150 }),
    ];
    const match = findMatchingFeeRuleWithFallback(rules, { ...ctx, entryType: "LATE" });
    expect(match?.id).toBe("late");
  });

  it("falls back from high late to late then normal", () => {
    const rules = [baseRule({ id: "normal", entryType: "NORMAL" })];
    const match = findMatchingFeeRuleWithFallback(rules, { ...ctx, entryType: "HIGH_LATE" });
    expect(match?.id).toBe("normal");
  });
});
