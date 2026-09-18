import type { FeePaymentSettlement, FeeStatementStatus } from "@/generated/prisma/enums";

/** Settlement when creating/issuing a statement with no further amount due. */
export function coveredSettlement(): FeePaymentSettlement {
  return "COVERED";
}

export function unpaidSettlement(): FeePaymentSettlement {
  return "NONE";
}

export function onlineSettlement(): FeePaymentSettlement {
  return "ONLINE";
}

export function offlineSettlement(): FeePaymentSettlement {
  return "OFFLINE";
}

export function settlementForIssuedOrPaid(amountDueGbp: number): {
  status: "ISSUED" | "PAID";
  paymentSettlement: FeePaymentSettlement;
} {
  if (amountDueGbp <= 0) {
    return { status: "PAID", paymentSettlement: "COVERED" };
  }
  return { status: "ISSUED", paymentSettlement: "NONE" };
}

/** Coarse unpaid vs paid for filters / badges. */
export function feePaymentPaidLabel(
  status: FeeStatementStatus | string,
  settlement?: FeePaymentSettlement | string | null,
): string {
  if (status === "DRAFT") return "—";
  if (status === "PAID") {
    switch (settlement) {
      case "ONLINE":
        return "Paid · Online";
      case "OFFLINE":
        return "Paid · Offline";
      case "COVERED":
        return "Paid · Covered";
      default:
        return "Paid";
    }
  }
  if (status === "ISSUED" || status === "NEEDS_REGENERATION") return "Unpaid";
  return "—";
}

export function feePaymentPaidClass(
  status: FeeStatementStatus | string,
  settlement?: FeePaymentSettlement | string | null,
): string {
  if (status === "PAID") {
    if (settlement === "OFFLINE") return "bg-amber-100 text-amber-900";
    if (settlement === "COVERED") return "bg-slate-100 text-slate-700";
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "ISSUED" || status === "NEEDS_REGENERATION") {
    return "bg-orange-100 text-orange-900";
  }
  return "bg-slate-100 text-slate-600";
}
