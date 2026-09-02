import type { PostResultRequestStatus } from "@/generated/prisma/client";

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

export function cashInRequestStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SUBMITTED":
      return "Submitted (awaiting board)";
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
