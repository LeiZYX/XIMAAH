import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  PaymentError,
  syncPaymentOrderFromGlobePay,
} from "@/lib/payments/globepay/orders";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER", "STUDENT"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!id) return jsonError("Payment order id is required");

  try {
    const order = await syncPaymentOrderFromGlobePay({
      paymentOrderId: id,
      userId: auth.user.id,
      role: auth.user.role,
    });
    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof PaymentError) {
      return jsonError(error.message, error.status);
    }
    console.error("Sync payment order failed:", error);
    return jsonError("Failed to sync payment order", 500);
  }
}
