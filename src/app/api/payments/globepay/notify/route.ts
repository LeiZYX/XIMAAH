import { NextRequest, NextResponse } from "next/server";
import { handleGlobePayPaymentNotice } from "@/lib/payments/globepay/notify";
import { PaymentError } from "@/lib/payments/globepay/orders";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await handleGlobePayPaymentNotice(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PaymentError) {
      console.error("GlobePay notify rejected:", error.message);
      return NextResponse.json(
        { return_code: error.status === 401 ? "INVALID_SIGN" : "FAIL", return_msg: error.message },
        { status: error.status },
      );
    }
    console.error("GlobePay notify failed:", error);
    return NextResponse.json(
      { return_code: "FAIL", return_msg: "Internal error" },
      { status: 500 },
    );
  }
}
