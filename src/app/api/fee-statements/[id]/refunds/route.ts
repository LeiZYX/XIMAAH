import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canRecordFeeRefunds, FEE_REFUND_RECORDER_ROLES } from "@/lib/auth/permissions";
import { FeeError } from "@/lib/fees/statement";
import {
  recordFeeRefund,
  type FeeRefundAllocationInput,
} from "@/lib/fees/refunds";

export const dynamic = "force-dynamic";

function parseAllocations(value: unknown): FeeRefundAllocationInput[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new FeeError("Invalid allocations");
  return value.map((row) => {
    if (!row || typeof row !== "object") throw new FeeError("Invalid allocations");
    const item = row as { offlineWithdrawalRefundId?: unknown; amountGbp?: unknown };
    if (typeof item.offlineWithdrawalRefundId !== "string" || !item.offlineWithdrawalRefundId) {
      throw new FeeError("Invalid allocations");
    }
    const amountGbp = Number(item.amountGbp);
    if (!Number.isFinite(amountGbp)) throw new FeeError("Invalid allocations");
    return { offlineWithdrawalRefundId: item.offlineWithdrawalRefundId, amountGbp };
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(FEE_REFUND_RECORDER_ROLES);
  if (auth.error) return auth.error;
  if (!canRecordFeeRefunds(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    method?: unknown;
    paymentOrderId?: unknown;
    amountGbp?: unknown;
    refundedAt?: unknown;
    externalReference?: unknown;
    reason?: unknown;
    note?: unknown;
    allocations?: unknown;
  } | null;
  if (!body) return jsonError("Invalid JSON body", 400);

  const method = body.method === "ORIGINAL_CHANNEL" || body.method === "OFFLINE" ? body.method : null;
  const reason =
    body.reason === "WITHDRAWAL" || body.reason === "OVERPAYMENT" || body.reason === "OTHER"
      ? body.reason
      : null;
  const refundedAt =
    typeof body.refundedAt === "string" ? new Date(body.refundedAt) : new Date(NaN);
  if (!method) return jsonError("Refund method is invalid");
  if (!reason) return jsonError("Refund reason is invalid");

  try {
    const result = await recordFeeRefund({
      statementId: id,
      performedByUserId: auth.user.id,
      method,
      paymentOrderId: typeof body.paymentOrderId === "string" ? body.paymentOrderId : null,
      amountGbp: Number(body.amountGbp),
      refundedAt,
      externalReference: typeof body.externalReference === "string" ? body.externalReference : "",
      reason,
      note: typeof body.note === "string" ? body.note : null,
      allocations: parseAllocations(body.allocations),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FeeError) return jsonError(error.message, 400);
    return jsonError(error instanceof Error ? error.message : "Could not record refund", 500);
  }
}
