import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canRecordFeeRefunds } from "@/lib/auth/permissions";
import { completeOfflineWithdrawalRefund } from "@/lib/fees/withdrawal-refund";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canRecordFeeRefunds(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  const result = await completeOfflineWithdrawalRefund({
    id,
    performedByUserId: auth.user.id,
  });
  return jsonError(result.error, result.status);
}
