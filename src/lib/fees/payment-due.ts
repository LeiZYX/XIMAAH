import { prisma } from "@/lib/prisma";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Successful online payments already collected for a registration workspace. */
export async function sumWorkspacePaidGbp(workspaceId: string): Promise<number> {
  const orders = await prisma.paymentOrder.findMany({
    where: {
      status: "PAID",
      feeStatement: { registrationWorkspaceId: workspaceId },
    },
    select: { amountGbp: true },
  });
  return roundMoney(orders.reduce((sum, row) => sum + Number(row.amountGbp), 0));
}

/**
 * Full fee total vs amount still due.
 * - No prior successful payment → due = full
 * - Prior payment(s) → due = max(0, full - paid)
 */
export function computeStatementPaymentSplit(params: {
  totalGbp: number;
  totalCny: number;
  previouslyPaidGbp: number;
}) {
  const totalGbp = roundMoney(params.totalGbp);
  const totalCny = roundMoney(params.totalCny);
  const previouslyPaidGbp = roundMoney(Math.max(0, params.previouslyPaidGbp));
  const amountDueGbp = roundMoney(Math.max(0, totalGbp - previouslyPaidGbp));

  const previouslyPaidCny =
    totalGbp > 0 ? roundMoney((previouslyPaidGbp / totalGbp) * totalCny) : 0;
  const amountDueCny = roundMoney(Math.max(0, totalCny - previouslyPaidCny));

  return {
    totalGbp,
    totalCny,
    previouslyPaidGbp,
    previouslyPaidCny,
    amountDueGbp,
    amountDueCny,
  };
}

/** Payable GBP for online payment / display (legacy rows fall back to total). */
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
