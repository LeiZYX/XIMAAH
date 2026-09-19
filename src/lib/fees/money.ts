export function toNumber(value: { toString(): string } | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatMoney(value: number, currency: "GBP" | "CNY"): string {
  const symbol = currency === "GBP" ? "£" : "¥";
  return `${symbol}${value.toFixed(2)}`;
}

/** Payable GBP for display (legacy rows fall back to the statement total). */
export function statementAmountDueGbp(statement: {
  totalGbpAmount: { toString(): string } | number | string;
  amountDueGbpAmount?: { toString(): string } | number | string | null;
}): number {
  if (
    statement.amountDueGbpAmount !== undefined &&
    statement.amountDueGbpAmount !== null &&
    statement.amountDueGbpAmount !== ""
  ) {
    return roundMoney(Number(statement.amountDueGbpAmount));
  }
  return roundMoney(Number(statement.totalGbpAmount));
}
