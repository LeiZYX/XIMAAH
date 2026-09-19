import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canRecordFeeRefunds } from "@/lib/auth/permissions";
import { FeeError } from "@/lib/fees/statement";
import { getFeeRefundContext } from "@/lib/fees/refunds";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canRecordFeeRefunds(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  try {
    const payload = await getFeeRefundContext(id);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof FeeError) return jsonError(error.message, 400);
    return jsonError("Could not load refund details", 500);
  }
}
