/** Shown beside Refund due. Not FeeStatement.status. */
export type FeeRefundDisplayStatus = "NONE" | "PENDING" | "PARTIAL" | "SETTLED";

export function feeRefundStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "PENDING":
      return "待退";
    case "PARTIAL":
      return "部分已退";
    case "SETTLED":
      return "已退完";
    default:
      return "No refund";
  }
}

export function feeRefundStatusClass(status: string | null | undefined): string {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-900";
    case "PARTIAL":
      return "bg-sky-100 text-sky-900";
    case "SETTLED":
      return "bg-green-100 text-green-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}
