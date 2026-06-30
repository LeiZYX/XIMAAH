import type { FeeStatementDisplayCurrencyOption } from "@/lib/fees/display-currency";
import { formatMoney } from "@/lib/fees/money";

export interface SalesAmountInput {
  salesGbp: number;
  salesCny: number;
}

export function formatSalesAmount(
  amounts: SalesAmountInput,
  displayCurrency: FeeStatementDisplayCurrencyOption,
): string[] {
  switch (displayCurrency) {
    case "GBP":
      return [formatMoney(amounts.salesGbp, "GBP")];
    case "CNY":
      return [formatMoney(amounts.salesCny, "CNY")];
    case "BOTH":
      return [
        `${formatMoney(amounts.salesGbp, "GBP")} / ${formatMoney(amounts.salesCny, "CNY")}`,
      ];
    default:
      return [formatMoney(amounts.salesGbp, "GBP")];
  }
}

export function formatSalesAmountInline(
  amounts: SalesAmountInput,
  displayCurrency: FeeStatementDisplayCurrencyOption,
): string {
  return formatSalesAmount(amounts, displayCurrency).join("\n");
}
