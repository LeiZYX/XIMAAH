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
