import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canGenerateFeeStatements } from "@/lib/auth/permissions";
import { completeOfflineWithdrawalRefund } from "@/lib/fees/withdrawal-refund";
import { toNumber } from "@/lib/fees/money";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canGenerateFeeStatements(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    offlineReference?: string;
    offlineNote?: string;
  };

  const result = await completeOfflineWithdrawalRefund({
    id,
    performedByUserId: auth.user.id,
    offlineReference: body.offlineReference,
    offlineNote: body.offlineNote,
  });

  if ("error" in result && result.error) {
    return jsonError(result.error, result.status);
  }

  const refund = result.refund!;
  return NextResponse.json({
    ...refund,
    salesAmountGbp: toNumber(refund.salesAmountGbp),
    creditGbp: toNumber(refund.creditGbp),
    effectiveRefundPercent: toNumber(refund.effectiveRefundPercent),
  });
}
