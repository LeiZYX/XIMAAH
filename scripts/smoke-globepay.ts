/**
 * Smoke-test GlobePay QR create (no DB required).
 *
 * Usage:
 *   npx tsx scripts/smoke-globepay.ts
 *
 * Requires in .env:
 *   GLOBEPAY_PARTNER_CODE
 *   GLOBEPAY_CREDENTIAL_CODE
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";

const partnerCode = process.env.GLOBEPAY_PARTNER_CODE?.trim();
const credentialCode = process.env.GLOBEPAY_CREDENTIAL_CODE?.trim();
const baseUrl = (process.env.GLOBEPAY_BASE_URL?.trim() || "https://pay.globepay.co").replace(
  /\/$/,
  "",
);
const notifyUrl =
  process.env.GLOBEPAY_NOTIFY_URL?.trim() || "http://localhost:3000/api/payments/globepay/notify";

if (!partnerCode || !credentialCode) {
  console.error("Missing GLOBEPAY_PARTNER_CODE or GLOBEPAY_CREDENTIAL_CODE in .env");
  process.exit(1);
}

const time = Date.now();
const nonceStr = randomBytes(8).toString("hex");
const sign = createHash("sha256")
  .update(`${partnerCode}&${time}&${nonceStr}&${credentialCode}`)
  .digest("hex")
  .toLowerCase();

const orderId = `SMOKE-${time}`;
const query = new URLSearchParams({
  time: String(time),
  nonce_str: nonceStr,
  sign,
});

const url = `${baseUrl}/api/v1.0/gateway/partners/${encodeURIComponent(partnerCode)}/orders/${encodeURIComponent(orderId)}?${query}`;

async function main() {
  console.log("Partner:", partnerCode);
  console.log("Order:", orderId);
  console.log("POST/PUT create QR order...");

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: "XIMA local smoke test",
      price: 100, // £1.00
      currency: "GBP",
      channel: "Wechat",
      notify_url: notifyUrl,
      operator: "xima-smoke-test",
    }),
  });

  const text = await response.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.error("Non-JSON response:", response.status, text.slice(0, 500));
    process.exit(1);
  }

  console.log("HTTP", response.status);
  console.log(JSON.stringify(data, null, 2));

  if (data.return_code === "SUCCESS" && (data.code_url || data.qrcode_img || data.pay_url)) {
    console.log("\nOK — GlobePay credentials work. QR/order created.");
    console.log("Note: localhost notify_url will not receive callbacks; use sync after real payment.");
    process.exit(0);
  }

  console.error("\nFAILED — check partner code, credential, and gateway permission.");
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
