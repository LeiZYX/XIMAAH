import type { FeeStatementDisplayCurrencyOption } from "@/lib/fees/display-currency";
import { formatSalesAmount, type SalesAmountInput } from "@/lib/fees/sales-display";

interface SalesAmountDisplayProps {
  amounts: SalesAmountInput;
  displayCurrency: FeeStatementDisplayCurrencyOption;
  label?: string;
  className?: string;
}

export function SalesAmountDisplay({
  amounts,
  displayCurrency,
  label = "Sales",
  className = "",
}: SalesAmountDisplayProps) {
  const lines = formatSalesAmount(amounts, displayCurrency);

  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {displayCurrency === "BOTH" ? (
        <div className="mt-1 space-y-0.5 text-sm font-medium text-slate-900">
          <p>{lines[0]?.split(" / ")[0]}</p>
          <p>{lines[0]?.split(" / ")[1]}</p>
        </div>
      ) : (
        <p className="mt-1 text-sm font-medium text-slate-900">{lines[0]}</p>
      )}
    </div>
  );
}
