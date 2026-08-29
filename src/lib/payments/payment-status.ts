export function paymentOrderStatusLabel(status: string): string {
  switch (status) {
    case "CREATED":
      return "Awaiting payment";
    case "PAYING":
      return "Payment in progress";
    case "PAID":
      return "Paid";
    case "CLOSED":
      return "Closed";
    case "CANCELLED":
      return "Cancelled";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

export function paymentOrderStatusClass(status: string): string {
  switch (status) {
    case "PAID":
      return "bg-emerald-100 text-emerald-800";
    case "CREATED":
    case "PAYING":
      return "bg-amber-100 text-amber-900";
    case "CANCELLED":
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "CLOSED":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

/** Summarise online payment state for EO/Admin list views. */
export function summariseStatementPayments(
  orders: Array<{ status: string; channel: string; partnerOrderId: string; amountGbp: string }>,
) {
  if (orders.length === 0) {
    return { label: "No online order", tone: "muted" as const, openCount: 0, paid: false };
  }
  if (orders.some((o) => o.status === "PAID")) {
    const paid = orders.find((o) => o.status === "PAID")!;
    return {
      label: `Paid · ${paid.channel} · £${paid.amountGbp}`,
      tone: "paid" as const,
      openCount: 0,
      paid: true,
    };
  }
  const open = orders.filter((o) => o.status === "CREATED" || o.status === "PAYING");
  if (open.length > 0) {
    const channels = open.map((o) => o.channel).join(" / ");
    return {
      label: `Unpaid · ${channels} (${open.length} open)`,
      tone: "unpaid" as const,
      openCount: open.length,
      paid: false,
    };
  }
  if (orders.every((o) => o.status === "CANCELLED")) {
    return { label: "All orders cancelled", tone: "cancelled" as const, openCount: 0, paid: false };
  }
  return { label: "No open order", tone: "muted" as const, openCount: 0, paid: false };
}
