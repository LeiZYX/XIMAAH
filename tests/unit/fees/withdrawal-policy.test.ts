import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY,
  defaultStageWithdrawal,
  effectiveWithdrawalRefundPercent,
  normalizeWithdrawalPolicyInput,
} from "@/lib/fees/withdrawal-policy";

describe("effectiveWithdrawalRefundPercent", () => {
  it("applies payment fee ceiling when configured refund is 100%", () => {
    expect(
      effectiveWithdrawalRefundPercent({
        refundEnabled: true,
        configuredPercent: 100,
        paymentFeePercent: 2,
      }),
    ).toBe(98);
  });

  it("keeps late 50% when below the fee ceiling", () => {
    expect(
      effectiveWithdrawalRefundPercent({
        refundEnabled: true,
        configuredPercent: 50,
        paymentFeePercent: 2,
      }),
    ).toBe(50);
  });

  it("returns 0 when refunds are disabled", () => {
    expect(
      effectiveWithdrawalRefundPercent({
        refundEnabled: false,
        configuredPercent: 50,
        paymentFeePercent: 2,
      }),
    ).toBe(0);
  });
});

describe("defaultStageWithdrawal", () => {
  it("uses frozen board defaults", () => {
    expect(defaultStageWithdrawal("NORMAL").withdrawalRefundPercent).toBe(100);
    expect(defaultStageWithdrawal("LATE").withdrawalRefundPercent).toBe(50);
    expect(defaultStageWithdrawal("HIGH_LATE").withdrawalRefundEnabled).toBe(false);
    expect(defaultStageWithdrawal("HIGH_LATE").withdrawalRefundPercent).toBe(0);
  });
});

describe("normalizeWithdrawalPolicyInput", () => {
  it("zeros percent when a stage disables refunds", () => {
    const normalized = normalizeWithdrawalPolicyInput({
      ...DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY,
      highLateRefundEnabled: false,
      highLateRefundPercent: 40,
    });
    expect(normalized.highLateRefundPercent).toBe(0);
  });
});
