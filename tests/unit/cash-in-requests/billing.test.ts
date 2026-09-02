import { describe, expect, it } from "vitest";
import {
  dualCurrencyFromQuotedSales,
  isCashInFeeStatementPayable,
} from "@/lib/cash-in-requests/billing";
import {
  formatPostResultsFeeStatementNumber,
  postResultsFeeStatementNumberPattern,
} from "@/lib/registrations/numbering";

describe("dualCurrencyFromQuotedSales", () => {
  it("keeps GBP sales and converts to CNY when a rate is present", () => {
    expect(
      dualCurrencyFromQuotedSales({
        salesAmount: 50,
        salesCurrency: "GBP",
        exchangeRateGbpToCny: 9.2,
      }),
    ).toEqual({
      salesGbp: 50,
      salesCny: 460,
      exchangeRateGbpToCny: 9.2,
    });
  });

  it("converts CNY sales to GBP when a rate is present", () => {
    expect(
      dualCurrencyFromQuotedSales({
        salesAmount: 460,
        salesCurrency: "CNY",
        exchangeRateGbpToCny: 9.2,
      }),
    ).toEqual({
      salesGbp: 50,
      salesCny: 460,
      exchangeRateGbpToCny: 9.2,
    });
  });

  it("falls back to the same numeric amount when no rate is available", () => {
    expect(
      dualCurrencyFromQuotedSales({
        salesAmount: 50,
        salesCurrency: "GBP",
        exchangeRateGbpToCny: null,
      }),
    ).toEqual({
      salesGbp: 50,
      salesCny: 50,
      exchangeRateGbpToCny: null,
    });
  });
});

describe("isCashInFeeStatementPayable", () => {
  it("treats PAID as payable", () => {
    expect(
      isCashInFeeStatementPayable({
        status: "PAID",
        totalGbpAmount: 50,
        amountDueGbpAmount: 0,
      }),
    ).toBe(true);
  });

  it("treats ISSUED with zero due as payable", () => {
    expect(
      isCashInFeeStatementPayable({
        status: "ISSUED",
        totalGbpAmount: 50,
        amountDueGbpAmount: 0,
      }),
    ).toBe(true);
  });

  it("rejects unpaid ISSUED statements", () => {
    expect(
      isCashInFeeStatementPayable({
        status: "ISSUED",
        totalGbpAmount: 50,
        amountDueGbpAmount: 50,
      }),
    ).toBe(false);
  });

  it("rejects cancelled statements", () => {
    expect(
      isCashInFeeStatementPayable({
        status: "CANCELLED",
        totalGbpAmount: 50,
        amountDueGbpAmount: 0,
      }),
    ).toBe(false);
  });
});

describe("post-results fee statement numbering", () => {
  it("formats FS-PR-YYYY-######", () => {
    expect(postResultsFeeStatementNumberPattern(2026)).toBe("FS-PR-2026-");
    expect(formatPostResultsFeeStatementNumber(2026, 12)).toBe("FS-PR-2026-000012");
  });
});
