export type FeeStatementDisplayCurrencyOption = "GBP" | "CNY" | "BOTH";

export const DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY: FeeStatementDisplayCurrencyOption = "GBP";

export function shouldShowExchangeRate(
  displayCurrency: FeeStatementDisplayCurrencyOption,
): boolean {
  return displayCurrency === "BOTH";
}
