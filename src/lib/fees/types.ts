import type {
  FeeCurrency,
  FeeEntryType,
  FeeMarkupType,
  FeeStatementDisplayCurrency,
} from "@/generated/prisma/enums";

export type { FeeCurrency, FeeEntryType, FeeMarkupType, FeeStatementDisplayCurrency };

export interface FeeRuleMatchContext {
  examBoardId: string;
  examSeriesId: string;
  qualificationId: string;
  subjectId: string;
  paperId: string;
  examSessionId: string;
  entryType: FeeEntryType;
}

export interface FeeRuleRecord {
  id: string;
  registrationWindowId: string;
  examBoardId: string;
  examSeriesId: string;
  qualificationId: string;
  subjectId: string | null;
  paperId: string | null;
  examSessionId: string | null;
  entryType: FeeEntryType;
  costCurrency: FeeCurrency;
  costAmount: { toString(): string } | number | string;
  exchangeRateToCny: { toString(): string } | number | string | null;
  markupType: FeeMarkupType;
  markupValue: { toString(): string } | number | string | null;
  salesCurrency: FeeCurrency;
  salesAmount: { toString(): string } | number | string | null;
  isActive: boolean;
}

export interface ExchangeRateRecord {
  baseCurrency: FeeCurrency;
  targetCurrency: FeeCurrency;
  rate: { toString(): string } | number | string;
}

export interface CalculatedFeeLine {
  examSessionId: string;
  examBoardSnapshot: string;
  qualificationSnapshot: string;
  subjectSnapshot: string;
  paperCodeSnapshot: string;
  paperTitleSnapshot: string;
  entryTypeSnapshot: FeeEntryType;
  costCurrencySnapshot: FeeCurrency;
  costAmountSnapshot: number;
  exchangeRateSnapshot: number | null;
  markupTypeSnapshot: FeeMarkupType;
  markupValueSnapshot: number | null;
  salesGbpAmountSnapshot: number;
  salesCnyAmountSnapshot: number;
  displayCurrencySnapshot: FeeStatementDisplayCurrency;
  lineTotalGbp: number;
  lineTotalCny: number;
  quantity: number;
  feeRuleId: string | null;
}

export interface MissingFeeRuleWarning {
  examSessionId: string;
  subject: string;
  paperCode: string;
  paperTitle: string;
  entryType: FeeEntryType;
}
