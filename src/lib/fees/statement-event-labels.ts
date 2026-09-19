export function feeStatementEventLabel(kind: string): string {
  switch (kind) {
    case "GENERATED":
      return "Generated";
    case "ISSUED":
      return "Issued";
    case "COVERED":
      return "Paid · Covered";
    case "ORDER_CREATED":
      return "Payment order created";
    case "ORDER_CANCELLED":
      return "Payment order cancelled";
    case "ORDER_CLOSED":
      return "Payment order closed";
    case "PAID_ONLINE":
      return "Paid online";
    case "MARKED_PAID_OFFLINE":
      return "Marked paid offline";
    case "NEEDS_REGENERATION":
      return "Needs regeneration";
    case "REGENERATED":
      return "Regenerated";
    case "REPRICED":
      return "Repriced";
    case "SUPERSEDED":
      return "Superseded";
    case "REFUND_RECORDED":
      return "Refund recorded";
    default:
      return kind;
  }
}

export function feeStatementEventActorLabel(
  kind: string,
  actorName: string | null | undefined,
): string {
  if (actorName?.trim()) return actorName.trim();
  if (kind === "PAID_ONLINE") return "Customer (online payment)";
  return "System";
}
