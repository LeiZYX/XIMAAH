import { describe, expect, it } from "vitest";
import { calculateFeeAmounts, findExchangeRate } from "@/lib/fees/calculate";
import type { ExchangeRateRecord, FeeRuleRecord } from "@/lib/fees/types";

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

describe("calculateFeeAmounts", () => {
  const windowRates: ExchangeRateRecord[] = [
    {
      id: "rate-1",
      baseCurrency: "GBP",
      targetCurrency: "CNY",
      rate: 9,
      effectiveDate: new Date("2026-01-01"),
    },
  ];

  it("applies percentage markup in GBP", () => {
    const amounts = calculateFeeAmounts(baseRule(), windowRates);
    expect(amounts.salesGbp).toBe(110);
    expect(amounts.costGbp).toBe(100);
  });

  it("uses rule-level exchange rate over window rate", () => {
    const amounts = calculateFeeAmounts(
      baseRule({ costCurrency: "GBP", salesCurrency: "CNY", exchangeRateToCny: 8 }),
      windowRates,
    );
    expect(amounts.exchangeRateGbpToCny).toBe(8);
    expect(amounts.salesCny).toBe(880);
  });

  it("supports fixed amount markup", () => {
    const amounts = calculateFeeAmounts(
      baseRule({ markupType: "FIXED_AMOUNT", markupValue: 25 }),
      windowRates,
    );
    expect(amounts.salesGbp).toBe(125);
  });
});

describe("findExchangeRate", () => {
  it("returns 1 for same currency", () => {
    expect(findExchangeRate([], "GBP", "GBP")).toBe(1);
  });

  it("finds GBP to CNY window rate", () => {
    const rates: ExchangeRateRecord[] = [
      {
        id: "r1",
        baseCurrency: "GBP",
        targetCurrency: "CNY",
        rate: 9.25,
        effectiveDate: new Date(),
      },
    ];
    expect(findExchangeRate(rates, "GBP", "CNY")).toBe(9.25);
  });
});
