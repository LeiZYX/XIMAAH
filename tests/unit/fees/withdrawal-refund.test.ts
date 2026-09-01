import { describe, expect, it } from "vitest";
import { computeWithdrawalCredit } from "@/lib/fees/withdrawal-refund";

describe("computeWithdrawalCredit", () => {
  it("applies late 50% without extra payment-fee cut", () => {
    const result = computeWithdrawalCredit({
      salesAmountGbp: 100,
      salesAmountCny: 1000,
      refundEnabled: true,
      configuredPercent: 50,
      paymentFeePercent: 2,
      feeStageCode: "LATE",
      sourceNote: "test",
    });
    expect(result.effectiveRefundPercent).toBe(50);
    expect(result.creditGbp).toBe(50);
    expect(result.creditCny).toBe(500);
    expect(result.status).toBe("PENDING_OFFLINE");
  });

  it("caps normal 100% at payment fee ceiling", () => {
    const result = computeWithdrawalCredit({
      salesAmountGbp: 100,
      refundEnabled: true,
      configuredPercent: 100,
      paymentFeePercent: 2,
      feeStageCode: "NORMAL",
      sourceNote: "test",
    });
    expect(result.effectiveRefundPercent).toBe(98);
    expect(result.creditGbp).toBe(98);
    expect(result.status).toBe("PENDING_OFFLINE");
  });

  it("records zero when high late disables refunds", () => {
    const result = computeWithdrawalCredit({
      salesAmountGbp: 100,
      refundEnabled: false,
      configuredPercent: 0,
      paymentFeePercent: 2,
      feeStageCode: "HIGH_LATE",
      sourceNote: "test",
    });
    expect(result.creditGbp).toBe(0);
    expect(result.status).toBe("ZERO_NO_REFUND");
  });
});
