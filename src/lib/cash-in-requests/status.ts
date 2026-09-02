import type { PostResultRequestStatus } from "@/generated/prisma/client";
import { isCashInFeeStatementPayable } from "@/lib/cash-in-requests/billing-utils";

export const CASH_IN_REQUEST_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "SENT_TO_BOARD",
  "COMPLETED",
  "CANCELLED",
] as const;

export type CashInRequestStatus = (typeof CASH_IN_REQUEST_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<CashInRequestStatus, CashInRequestStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["SENT_TO_BOARD", "CANCELLED"],
  SENT_TO_BOARD: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canCancelCashInRequest(status: PostResultRequestStatus | string): boolean {
  return status === "DRAFT" || status === "SUBMITTED";
}

export function canTransitionCashInRequestStatus(
  from: PostResultRequestStatus | string,
  to: PostResultRequestStatus | string,
): boolean {
  const allowed = ALLOWED_TRANSITIONS[from as CashInRequestStatus] ?? [];
  return allowed.includes(to as CashInRequestStatus);
}

export function cashInRequestStatusLabel(
  status: string,
  feeStatement?: {
    status: string;
    amountDueGbpAmount?: { toString(): string } | number | string | null;
    totalGbpAmount?: { toString(): string } | number | string;
  } | null,
): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SUBMITTED": {
      // No second arg (e.g. filter dropdown) → generic label
      if (feeStatement === undefined) return "Submitted";
      if (feeStatement === null) return "Submitted (no invoice)";
      if (String(feeStatement.status).toUpperCase() === "PAID") {
        return "Submitted (paid — ready for board)";
      }
      if (
        feeStatement.totalGbpAmount != null &&
        isCashInFeeStatementPayable({
          status: feeStatement.status,
          amountDueGbpAmount: feeStatement.amountDueGbpAmount,
          totalGbpAmount: feeStatement.totalGbpAmount,
        })
      ) {
        return "Submitted (paid — ready for board)";
      }
      return "Submitted (awaiting payment)";
    }
    case "SENT_TO_BOARD":
      return "Sent to board";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}
