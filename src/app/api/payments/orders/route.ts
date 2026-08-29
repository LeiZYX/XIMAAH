import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  createOrReusePaymentOrder,
  listPaymentOrdersForStatement,
  PaymentError,
} from "@/lib/payments/globepay/orders";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function isPaymentChannel(value: unknown): value is "Wechat" | "Alipay" {
  return value === "Wechat" || value === "Alipay";
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER", "STUDENT"]);
  if (auth.error) return auth.error;

  const feeStatementId = request.nextUrl.searchParams.get("feeStatementId")?.trim();
  if (!feeStatementId) {
    return jsonError("feeStatementId is required");
  }

  try {
    const orders = await listPaymentOrdersForStatement({
      feeStatementId,
      userId: auth.user.id,
      role: auth.user.role,
    });
    return NextResponse.json({ orders });
  } catch (error) {
    if (error instanceof PaymentError) {
      return jsonError(error.message, error.status);
    }
    console.error("List payment orders failed:", error);
    return jsonError("Failed to list payment orders", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER", "STUDENT"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const data = parseJsonBody<{ feeStatementId: string; channel: string }>(body, [
      "feeStatementId",
      "channel",
    ]);
    if (!data || !isPaymentChannel(data.channel)) {
      return jsonError("feeStatementId and channel (Wechat|Alipay) are required");
    }

    const order = await createOrReusePaymentOrder({
      feeStatementId: data.feeStatementId,
      channel: data.channel,
      userId: auth.user.id,
      role: auth.user.role,
    });

    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof PaymentError) {
      return jsonError(error.message, error.status);
    }
    console.error("Create payment order failed:", error);
    return jsonError("Failed to create payment order", 500);
  }
}
