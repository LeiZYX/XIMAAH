import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canGenerateFeeStatements } from "@/lib/auth/permissions";
import type { OfflineWithdrawalRefundStatus } from "@/generated/prisma/enums";
import { listOfflineWithdrawalRefunds } from "@/lib/fees/withdrawal-refund";
import { toNumber } from "@/lib/fees/money";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canGenerateFeeStatements(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const statusParam = request.nextUrl.searchParams.get("status") ?? "PENDING_OFFLINE";
  const registrationWindowId =
    request.nextUrl.searchParams.get("registrationWindowId") ?? undefined;

  const allowed = new Set(["PENDING_OFFLINE", "COMPLETED", "ZERO_NO_REFUND", "ALL"]);
  if (!allowed.has(statusParam)) {
    return jsonError("Invalid status filter", 400);
  }

  const rows = await listOfflineWithdrawalRefunds({
    status: statusParam as OfflineWithdrawalRefundStatus | "ALL",
    registrationWindowId,
  });

  return NextResponse.json(
    rows.map((row) => ({
      ...row,
      salesAmountGbp: toNumber(row.salesAmountGbp),
      salesAmountCny: row.salesAmountCny == null ? null : toNumber(row.salesAmountCny),
      configuredRefundPercent: toNumber(row.configuredRefundPercent),
      paymentFeePercent: toNumber(row.paymentFeePercent),
      effectiveRefundPercent: toNumber(row.effectiveRefundPercent),
      creditGbp: toNumber(row.creditGbp),
      creditCny: row.creditCny == null ? null : toNumber(row.creditCny),
    })),
  );
}
