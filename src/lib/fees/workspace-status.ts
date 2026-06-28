import type { FeeStatementStatus } from "@/generated/prisma/enums";

export interface FeeStatementStatusRow {
  id: string;
  status: FeeStatementStatus | string;
  generatedAt: Date | string;
  statementNo?: string;
}

const ACTIVE_STATUSES = new Set<FeeStatementStatus | string>(["DRAFT", "ISSUED", "PAID"]);

export function needsFeeStatementRegeneration(
  statements: FeeStatementStatusRow[],
  lastAdjustedAt: Date | string | null | undefined,
): boolean {
  if (!lastAdjustedAt || statements.length === 0) return false;

  const adjustedAt = new Date(lastAdjustedAt).getTime();
  const hasCurrentStatement = statements.some(
    (statement) =>
      ACTIVE_STATUSES.has(statement.status) &&
      new Date(statement.generatedAt).getTime() >= adjustedAt,
  );

  if (hasCurrentStatement) return false;

  return statements.some((statement) => statement.status === "NEEDS_REVIEW") ||
    statements.some((statement) => statement.status === "REVISED") ||
    statements.some(
      (statement) =>
        ACTIVE_STATUSES.has(statement.status) &&
        new Date(statement.generatedAt).getTime() < adjustedAt,
    );
}

export function hasIssuedFeeStatement(statements: FeeStatementStatusRow[]): boolean {
  return statements.some((statement) => statement.status === "ISSUED" || statement.status === "PAID");
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
    case "NEEDS_REVIEW":
      return "Needs review";
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
    case "NEEDS_REVIEW":
      return "bg-amber-100 text-amber-900";
    case "REVISED":
      return "bg-orange-100 text-orange-900";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
