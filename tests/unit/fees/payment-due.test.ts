import { describe, expect, it } from "vitest";
import {
  computeStatementPaymentSplit,
  statementAmountDueGbp,
} from "@/lib/fees/payment-due";

describe("computeStatementPaymentSplit", () => {
  it("charges full amount when nothing was paid", () => {
    expect(
      computeStatementPaymentSplit({
        totalGbp: 400,
        totalCny: 4000,
        previouslyPaidGbp: 0,
      }),
    ).toEqual({
      totalGbp: 400,
      totalCny: 4000,
      previouslyPaidGbp: 0,
      previouslyPaidCny: 0,
      amountDueGbp: 400,
      amountDueCny: 4000,
    });
  });

  it("charges only the balance when prior payment exists", () => {
    expect(
      computeStatementPaymentSplit({
        totalGbp: 500,
        totalCny: 5000,
        previouslyPaidGbp: 400,
      }),
    ).toEqual({
      totalGbp: 500,
      totalCny: 5000,
      previouslyPaidGbp: 400,
      previouslyPaidCny: 4000,
      amountDueGbp: 100,
      amountDueCny: 1000,
    });
  });

  it("never returns a negative due amount", () => {
    const split = computeStatementPaymentSplit({
      totalGbp: 300,
      totalCny: 3000,
      previouslyPaidGbp: 400,
    });
    expect(split.amountDueGbp).toBe(0);
    expect(split.amountDueCny).toBe(0);
  });
});

describe("statementAmountDueGbp", () => {
  it("prefers amountDue when present", () => {
    expect(
      statementAmountDueGbp({
        totalGbpAmount: 500,
        amountDueGbpAmount: 100,
      }),
    ).toBe(100);
  });

  it("falls back to total for legacy rows", () => {
    expect(
      statementAmountDueGbp({
        totalGbpAmount: 500,
        amountDueGbpAmount: null,
      }),
    ).toBe(500);
  });
});
