import type { FeeEntryType, WithdrawalRefundBasis } from "@/generated/prisma/enums";

export const DEFAULT_PAYMENT_FEE_PERCENT = 2;

export type StageWithdrawalDefaults = {
  withdrawalRefundEnabled: boolean;
  withdrawalRefundPercent: number;
  withdrawalRefundBasis: WithdrawalRefundBasis;
  withdrawalNotes: string | null;
};

export type ExamBoardWithdrawalPolicyInput = {
  paymentFeePercent: number;
  refundBasis: WithdrawalRefundBasis;
  normalRefundEnabled: boolean;
  normalRefundPercent: number;
  lateRefundEnabled: boolean;
  lateRefundPercent: number;
  highLateRefundEnabled: boolean;
  highLateRefundPercent: number;
  notes?: string | null;
};

export const DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY: ExamBoardWithdrawalPolicyInput = {
  paymentFeePercent: DEFAULT_PAYMENT_FEE_PERCENT,
  refundBasis: "SALES_AMOUNT",
  normalRefundEnabled: true,
  normalRefundPercent: 100,
  lateRefundEnabled: true,
  lateRefundPercent: 50,
  highLateRefundEnabled: false,
  highLateRefundPercent: 0,
  notes: null,
};

export function defaultStageWithdrawal(
  stageCode: FeeEntryType,
  policy: ExamBoardWithdrawalPolicyInput = DEFAULT_EXAM_BOARD_WITHDRAWAL_POLICY,
): StageWithdrawalDefaults {
  switch (stageCode) {
    case "NORMAL":
      return {
        withdrawalRefundEnabled: policy.normalRefundEnabled,
        withdrawalRefundPercent: policy.normalRefundPercent,
        withdrawalRefundBasis: policy.refundBasis,
        withdrawalNotes: null,
      };
    case "LATE":
      return {
        withdrawalRefundEnabled: policy.lateRefundEnabled,
        withdrawalRefundPercent: policy.lateRefundPercent,
        withdrawalRefundBasis: policy.refundBasis,
        withdrawalNotes: policy.lateRefundEnabled
          ? `Late withdrawal — ${policy.lateRefundPercent}% of sales amount`
          : "Late withdrawal — non-refundable",
      };
    case "HIGH_LATE":
      return {
        withdrawalRefundEnabled: policy.highLateRefundEnabled,
        withdrawalRefundPercent: policy.highLateRefundPercent,
        withdrawalRefundBasis: policy.refundBasis,
        withdrawalNotes: policy.highLateRefundEnabled
          ? `High late withdrawal — ${policy.highLateRefundPercent}% of sales amount`
          : "High late withdrawal — exam fee non-refundable",
      };
    default:
      return {
        withdrawalRefundEnabled: true,
        withdrawalRefundPercent: 100,
        withdrawalRefundBasis: policy.refundBasis,
        withdrawalNotes: null,
      };
  }
}

/** Actual refund % after payment-fee ceiling: min(configured, 100 - fee). */
export function effectiveWithdrawalRefundPercent(input: {
  refundEnabled: boolean;
  configuredPercent: number;
  paymentFeePercent: number;
}): number {
  if (!input.refundEnabled) return 0;
  const configured = clampPercent(input.configuredPercent);
  const fee = clampPercent(input.paymentFeePercent);
  const ceiling = Math.max(0, 100 - fee);
  return Math.min(configured, ceiling);
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function validateWithdrawalPolicyInput(
  input: Partial<ExamBoardWithdrawalPolicyInput>,
): string | null {
  const paymentFeePercent = Number(input.paymentFeePercent);
  if (!Number.isFinite(paymentFeePercent) || paymentFeePercent < 0 || paymentFeePercent > 100) {
    return "Payment fee percent must be between 0 and 100";
  }

  const pairs: Array<[string, boolean | undefined, number | undefined]> = [
    ["Normal", input.normalRefundEnabled, input.normalRefundPercent],
    ["Late", input.lateRefundEnabled, input.lateRefundPercent],
    ["High Late", input.highLateRefundEnabled, input.highLateRefundPercent],
  ];

  for (const [label, enabled, percent] of pairs) {
    if (typeof enabled !== "boolean") {
      return `${label} refund enabled flag is required`;
    }
    const value = Number(percent);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return `${label} refund percent must be between 0 and 100`;
    }
    if (!enabled && value !== 0) {
      // allow non-zero stored percent while disabled; normalize on save instead
    }
  }

  if (input.refundBasis && input.refundBasis !== "SALES_AMOUNT") {
    return "Refund basis must be sales amount";
  }

  return null;
}

export function normalizeWithdrawalPolicyInput(
  input: ExamBoardWithdrawalPolicyInput,
): ExamBoardWithdrawalPolicyInput {
  return {
    paymentFeePercent: clampPercent(Number(input.paymentFeePercent)),
    refundBasis: "SALES_AMOUNT",
    normalRefundEnabled: Boolean(input.normalRefundEnabled),
    normalRefundPercent: input.normalRefundEnabled
      ? clampPercent(Number(input.normalRefundPercent))
      : 0,
    lateRefundEnabled: Boolean(input.lateRefundEnabled),
    lateRefundPercent: input.lateRefundEnabled
      ? clampPercent(Number(input.lateRefundPercent))
      : 0,
    highLateRefundEnabled: Boolean(input.highLateRefundEnabled),
    highLateRefundPercent: input.highLateRefundEnabled
      ? clampPercent(Number(input.highLateRefundPercent))
      : 0,
    notes: input.notes?.trim() || null,
  };
}

export function serializeWithdrawalPolicy<T extends Record<string, unknown>>(row: T) {
  const decimalKeys = [
    "paymentFeePercent",
    "normalRefundPercent",
    "lateRefundPercent",
    "highLateRefundPercent",
  ] as const;

  const result: Record<string, unknown> = { ...row };
  for (const key of decimalKeys) {
    if (key in result && result[key] != null) {
      result[key] = Number(result[key]);
    }
  }
  return result;
}
