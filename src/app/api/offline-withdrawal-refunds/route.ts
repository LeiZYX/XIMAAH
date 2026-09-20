import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canGenerateFeeStatements, FEE_OPERATOR_ROLES } from "@/lib/auth/permissions";
import type { OfflineWithdrawalRefundStatus } from "@/generated/prisma/enums";
import { listOfflineWithdrawalRefundGroups } from "@/lib/fees/withdrawal-refund";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(FEE_OPERATOR_ROLES);
  if (auth.error) return auth.error;
  if (!canGenerateFeeStatements(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const statusParam = request.nextUrl.searchParams.get("status") ?? "PENDING_OFFLINE";
  const registrationWindowId =
    request.nextUrl.searchParams.get("registrationWindowId") ?? undefined;

  const allowed = new Set([
    "PENDING_OFFLINE",
    "COMPLETED",
    "ZERO_NO_REFUND",
    "NO_CASH_UNCOLLECTED",
    "ALL",
  ]);
  if (!allowed.has(statusParam)) {
    return jsonError("Invalid status filter", 400);
  }

  const groups = await listOfflineWithdrawalRefundGroups({
    status: statusParam as OfflineWithdrawalRefundStatus | "ALL",
    registrationWindowId: registrationWindowId || undefined,
  });

  return NextResponse.json({ groups });
}
