import { roundMoney, toNumber } from "@/lib/fees/money";

export const CASH_IN_SERVICE_NAME = "Cash-in";

/** Pure helpers safe for client components — do not import Prisma here. */

export function dualCurrencyFromQuotedSales(params: {
  salesAmount: number;
  salesCurrency: string;
  exchangeRateGbpToCny: number | null;
}): {
  salesGbp: number;
  salesCny: number;
  exchangeRateGbpToCny: number | null;
} {
  const salesAmount = roundMoney(params.salesAmount);
  const currency = params.salesCurrency;
  const rate =
    params.exchangeRateGbpToCny != null && params.exchangeRateGbpToCny > 0
      ? params.exchangeRateGbpToCny
      : null;

  if (currency === "GBP") {
    return {
      salesGbp: salesAmount,
      salesCny: rate ? roundMoney(salesAmount * rate) : salesAmount,
      exchangeRateGbpToCny: rate,
    };
  }

  if (currency === "CNY") {
    return {
      salesCny: salesAmount,
      salesGbp: rate ? roundMoney(salesAmount / rate) : salesAmount,
      exchangeRateGbpToCny: rate,
    };
  }

  throw new Error(`Unsupported sales currency: ${currency}`);
}

export function isCashInFeeStatementPayable(statement: {
  status: string;
  amountDueGbpAmount?: { toString(): string } | number | string | null;
  totalGbpAmount: { toString(): string } | number | string;
}): boolean {
  if (String(statement.status).toUpperCase() === "PAID") return true;
  if (String(statement.status).toUpperCase() !== "ISSUED") return false;
  const due =
    statement.amountDueGbpAmount != null && statement.amountDueGbpAmount !== ""
      ? toNumber(statement.amountDueGbpAmount)
      : toNumber(statement.totalGbpAmount);
  return due <= 0;
}
