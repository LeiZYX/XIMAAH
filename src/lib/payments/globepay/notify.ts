import type { Prisma } from "@/generated/prisma/client";
import { markPaymentOrderPaid, PaymentError } from "@/lib/payments/globepay/orders";
import { verifyGlobePayNotifySign } from "@/lib/payments/globepay/sign";

export interface GlobePayNotifyPayload {
  time: number | string;
  nonce_str: string;
  sign: string;
  channel_order_id?: string;
  partner_order_id: string;
  order_id?: string;
  total_fee?: number;
  real_fee?: number;
  currency?: string;
  channel?: string;
  create_time?: string;
  pay_time?: string;
  customer_id?: string;
  rate?: number;
}

export async function handleGlobePayPaymentNotice(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new PaymentError("Invalid notify payload");
  }

  const payload = body as Partial<GlobePayNotifyPayload>;
  if (
    payload.time === undefined ||
    !payload.nonce_str ||
    !payload.sign ||
    !payload.partner_order_id
  ) {
    throw new PaymentError("Missing required notify fields");
  }

  if (
    !verifyGlobePayNotifySign({
      time: payload.time,
      nonce_str: payload.nonce_str,
      sign: payload.sign,
    })
  ) {
    throw new PaymentError("Invalid notify signature", 401);
  }

  try {
    await markPaymentOrderPaid({
      partnerOrderId: payload.partner_order_id,
      globepayOrderId: payload.order_id ?? payload.channel_order_id ?? null,
      notifyPayload: payload as unknown as Prisma.InputJsonValue,
      payTime: payload.pay_time ?? null,
    });
  } catch (error) {
    if (error instanceof PaymentError && error.message.includes("closed")) {
      // Late payment on a closed order — acknowledge to stop retries; ops can reconcile manually.
      console.error("GlobePay notify for closed order:", payload.partner_order_id, error.message);
      return { return_code: "SUCCESS" as const };
    }
    throw error;
  }

  return { return_code: "SUCCESS" as const };
}
