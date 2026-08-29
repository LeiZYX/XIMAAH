import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  cancelPaymentOrder,
  PaymentError,
} from "@/lib/payments/globepay/orders";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!id) return jsonError("Payment order id is required");

  try {
    let note: string | undefined;
    try {
      const body = (await request.json()) as { note?: unknown };
      if (typeof body?.note === "string" && body.note.trim()) {
        note = body.note.trim();
      }
    } catch {
      // empty body is fine
    }

    const order = await cancelPaymentOrder({
      paymentOrderId: id,
      cancelledByUserId: auth.user.id,
      note,
    });
    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof PaymentError) {
      return jsonError(error.message, error.status);
    }
    console.error("Cancel payment order failed:", error);
    return jsonError("Failed to cancel payment order", 500);
  }
}
