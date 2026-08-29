import type { PaymentChannel } from "@/generated/prisma/client";
import { buildSignedQuery, getGlobePayConfig } from "@/lib/payments/globepay/sign";

export class GlobePayError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "GlobePayError";
  }
}

export interface CreateQrCodeOrderInput {
  partnerOrderId: string;
  description: string;
  /** Amount in minor units (pence for GBP). */
  price: number;
  currency?: "GBP";
  channel: PaymentChannel;
  notifyUrl?: string;
  operator?: string;
}

export interface CreateQrCodeOrderResult {
  return_code: string;
  result_code?: string;
  return_msg?: string;
  channel?: string;
  partner_code?: string;
  order_id?: string;
  partner_order_id?: string;
  code_url?: string;
  qrcode_img?: string;
  pay_url?: string;
}

export interface QueryOrderStatusResult {
  return_code: string;
  result_code?: string;
  return_msg?: string;
  order_id?: string;
  partner_order_id?: string;
  total_fee?: number;
  real_fee?: number;
  currency?: string;
  channel?: string;
  pay_time?: string;
  create_time?: string;
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new GlobePayError(
      `GlobePay returned non-JSON response (${response.status})`,
      "INVALID_RESPONSE",
      text.slice(0, 500),
    );
  }
}

export async function createQrCodePaymentOrder(
  input: CreateQrCodeOrderInput,
): Promise<CreateQrCodeOrderResult> {
  const config = getGlobePayConfig();
  const notifyUrl = input.notifyUrl ?? config.notifyUrl;
  if (!notifyUrl) {
    throw new GlobePayError(
      "GlobePay notify URL is not configured. Set GLOBEPAY_NOTIFY_URL or APP_URL.",
      "MISSING_NOTIFY_URL",
    );
  }

  const query = buildSignedQuery();
  const url = `${config.baseUrl}/api/v1.0/gateway/partners/${encodeURIComponent(config.partnerCode)}/orders/${encodeURIComponent(input.partnerOrderId)}?${query}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: input.description,
      price: input.price,
      currency: input.currency ?? "GBP",
      channel: input.channel,
      notify_url: notifyUrl,
      operator: input.operator ?? "xima-assessment-hub",
    }),
  });

  const data = (await parseJsonResponse(response)) as unknown as CreateQrCodeOrderResult;
  if (!response.ok || data.return_code !== "SUCCESS") {
    throw new GlobePayError(
      data.return_msg || `GlobePay create order failed (${response.status})`,
      data.return_code,
      data,
    );
  }

  return data;
}

export async function queryGlobePayOrderStatus(
  partnerOrderId: string,
): Promise<QueryOrderStatusResult> {
  const config = getGlobePayConfig();
  const query = buildSignedQuery();
  const url = `${config.baseUrl}/api/v1.0/gateway/partners/${encodeURIComponent(config.partnerCode)}/orders/${encodeURIComponent(partnerOrderId)}?${query}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const data = (await parseJsonResponse(response)) as unknown as QueryOrderStatusResult;
  if (!response.ok || data.return_code !== "SUCCESS") {
    throw new GlobePayError(
      data.return_msg || `GlobePay query order failed (${response.status})`,
      data.return_code,
      data,
    );
  }

  return data;
}

export interface RevokeOrderResult {
  return_code: string;
  return_msg?: string;
  status?: string;
  order_id?: string;
  client_order_id?: string;
}

/** Revoke an unpaid GlobePay order. Paid orders cannot be revoked. */
export async function revokeGlobePayOrder(partnerOrderId: string): Promise<RevokeOrderResult> {
  const config = getGlobePayConfig();
  const query = buildSignedQuery();
  const url = `${config.baseUrl}/api/v1.0/gateway/partners/${encodeURIComponent(config.partnerCode)}/orders/${encodeURIComponent(partnerOrderId)}/revoke?${query}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const data = (await parseJsonResponse(response)) as unknown as RevokeOrderResult;
  if (!response.ok || data.return_code !== "SUCCESS") {
    throw new GlobePayError(
      data.return_msg || `GlobePay revoke failed (${response.status})`,
      data.return_code,
      data,
    );
  }

  return data;
}
