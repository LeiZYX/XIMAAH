import type { FeeStatementStatus } from "@/generated/prisma/enums";

export interface FeeStatementStatusRow {
  id: string;
  status: FeeStatementStatus | string;
  generatedAt: Date | string;
  statementNo?: string;
  regenerationReason?: string | null;
  regenerationChangedAt?: Date | string | null;
  regenerationChangedBy?: { name: string } | null;
}

const CURRENT_VALID_STATUSES = new Set<FeeStatementStatus | string>(["ISSUED", "PAID"]);

export function needsFeeStatementRegeneration(
  statements: FeeStatementStatusRow[],
  _lastAdjustedAt?: Date | string | null | undefined,
): boolean {
  return statements.some((statement) => statement.status === "NEEDS_REGENERATION");
}

export function getOutdatedFeeStatement(statements: FeeStatementStatusRow[]) {
  return statements.find((statement) => statement.status === "NEEDS_REGENERATION") ?? null;
}

export function hasIssuedFeeStatement(statements: FeeStatementStatusRow[]): boolean {
  return statements.some((statement) => CURRENT_VALID_STATUSES.has(statement.status));
}

export function hasCurrentValidFeeStatement(statements: FeeStatementStatusRow[]): boolean {
  return statements.some((statement) => CURRENT_VALID_STATUSES.has(statement.status));
}

export function feeStatementStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "ISSUED":
      return "Issued";
    case "PAID":
      return "Paid";
    case "REVISED":
      return "Superseded";
    case "NEEDS_REGENERATION":
      return "Needs Regeneration";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function feeStatementStatusClass(status: string): string {
  switch (status) {
    case "ISSUED":
    case "PAID":
      return "bg-emerald-100 text-emerald-800";
    case "DRAFT":
      return "bg-slate-100 text-slate-700";
    case "NEEDS_REGENERATION":
      return "bg-amber-100 text-amber-900";
    case "REVISED":
      return "bg-orange-100 text-orange-900";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export const REPORTABLE_FEE_STATEMENT_STATUSES = ["ISSUED", "PAID"] as const;

export const PENDING_REVISION_FEE_STATEMENT_STATUS = "NEEDS_REGENERATION" as const;
