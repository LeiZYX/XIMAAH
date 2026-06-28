import type { FeeCurrency, FeeMarkupType } from "@/generated/prisma/enums";
import { roundMoney, toNumber } from "@/lib/fees/money";
import type { ExchangeRateRecord, FeeRuleRecord } from "@/lib/fees/types";

export interface FeeAmounts {
  costGbp: number;
  costCny: number;
  salesGbp: number;
  salesCny: number;
  exchangeRateGbpToCny: number | null;
}

export function findExchangeRate(
  rates: ExchangeRateRecord[],
  base: FeeCurrency,
  target: FeeCurrency,
): number | null {
  if (base === target) return 1;
  const match = rates.find((r) => r.baseCurrency === base && r.targetCurrency === target);
  return match ? toNumber(match.rate) : null;
}

function convertAmount(
  amount: number,
  from: FeeCurrency,
  to: FeeCurrency,
  gbpToCny: number | null,
): number {
  if (from === to) return amount;
  if (from === "GBP" && to === "CNY" && gbpToCny) return roundMoney(amount * gbpToCny);
  if (from === "CNY" && to === "GBP" && gbpToCny) return roundMoney(amount / gbpToCny);
  return amount;
}

export function calculateFeeAmounts(
  rule: FeeRuleRecord,
  exchangeRates: ExchangeRateRecord[],
): FeeAmounts {
  const costAmount = toNumber(rule.costAmount);
  const ruleRate = rule.exchangeRateToCny ? toNumber(rule.exchangeRateToCny) : null;
  const windowRate = findExchangeRate(exchangeRates, "GBP", "CNY");
  const gbpToCny = ruleRate ?? windowRate;

  const costGbp =
    rule.costCurrency === "GBP" ? costAmount : convertAmount(costAmount, "CNY", "GBP", gbpToCny);
  const costCny =
    rule.costCurrency === "CNY" ? costAmount : convertAmount(costAmount, "GBP", "CNY", gbpToCny);

  let salesGbp: number;
  let salesCny: number;

  if (rule.markupType === "MANUAL" && rule.salesAmount !== null) {
    const manual = toNumber(rule.salesAmount);
    if (rule.salesCurrency === "GBP") {
      salesGbp = manual;
      salesCny = convertAmount(manual, "GBP", "CNY", gbpToCny);
    } else {
      salesCny = manual;
      salesGbp = convertAmount(manual, "CNY", "GBP", gbpToCny);
    }
  } else {
    const markupValue = toNumber(rule.markupValue);
    const baseForMarkup =
      rule.salesCurrency === "GBP"
        ? rule.costCurrency === "GBP"
          ? costAmount
          : convertAmount(costAmount, rule.costCurrency, "GBP", gbpToCny)
        : rule.costCurrency === "CNY"
          ? costAmount
          : convertAmount(costAmount, rule.costCurrency, "CNY", gbpToCny);

    let salesInTarget: number;
    if (rule.markupType === "PERCENTAGE") {
      salesInTarget = roundMoney(baseForMarkup * (1 + markupValue / 100));
    } else {
      salesInTarget = roundMoney(baseForMarkup + markupValue);
    }

    if (rule.salesCurrency === "GBP") {
      salesGbp = salesInTarget;
      salesCny = convertAmount(salesInTarget, "GBP", "CNY", gbpToCny);
    } else {
      salesCny = salesInTarget;
      salesGbp = convertAmount(salesInTarget, "CNY", "GBP", gbpToCny);
    }
  }

  return {
    costGbp: roundMoney(costGbp),
    costCny: roundMoney(costCny),
    salesGbp: roundMoney(salesGbp),
    salesCny: roundMoney(salesCny),
    exchangeRateGbpToCny: gbpToCny,
  };
}

export function previewSalesAmount(
  costCurrency: FeeCurrency,
  costAmount: number,
  exchangeRateToCny: number | null,
  markupType: FeeMarkupType,
  markupValue: number | null,
  salesCurrency: FeeCurrency,
  salesAmount: number | null,
  windowRates: ExchangeRateRecord[],
): { salesGbp: number; salesCny: number } {
  return calculateFeeAmounts(
    {
      id: "",
      registrationWindowId: "",
      examBoardId: "",
      examSeriesId: "",
      qualificationId: "",
      subjectId: null,
      paperId: null,
      examSessionId: null,
      entryType: "NORMAL",
      costCurrency,
      costAmount,
      exchangeRateToCny,
      markupType,
      markupValue,
      salesCurrency,
      salesAmount,
      isActive: true,
    },
    windowRates,
  );
}
