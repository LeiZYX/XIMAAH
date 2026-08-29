import { createHash, randomBytes } from "node:crypto";

export function getGlobePayConfig() {
  const partnerCode = process.env.GLOBEPAY_PARTNER_CODE?.trim();
  const credentialCode = process.env.GLOBEPAY_CREDENTIAL_CODE?.trim();
  const baseUrl = (process.env.GLOBEPAY_BASE_URL?.trim() || "https://pay.globepay.co").replace(
    /\/$/,
    "",
  );
  const notifyUrl =
    process.env.GLOBEPAY_NOTIFY_URL?.trim() ||
    (() => {
      const appUrl =
        process.env.APP_URL?.trim() ||
        process.env.APP_BASE_URL?.trim() ||
        process.env.NEXTAUTH_URL?.trim();
      return appUrl ? `${appUrl.replace(/\/$/, "")}/api/payments/globepay/notify` : undefined;
    })();

  if (!partnerCode || !credentialCode) {
    throw new Error(
      "GlobePay is not configured. Set GLOBEPAY_PARTNER_CODE and GLOBEPAY_CREDENTIAL_CODE.",
    );
  }

  return { partnerCode, credentialCode, baseUrl, notifyUrl };
}

export function createNonceStr(length = 16): string {
  return randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

export function signGlobePayRequest(params: {
  partnerCode: string;
  time: number;
  nonceStr: string;
  credentialCode: string;
}): string {
  const validString = `${params.partnerCode}&${params.time}&${params.nonceStr}&${params.credentialCode}`;
  return createHash("sha256").update(validString).digest("hex").toLowerCase();
}

export function buildSignedQuery(params?: {
  partnerCode?: string;
  credentialCode?: string;
}): string {
  const config = params?.partnerCode && params?.credentialCode
    ? {
        partnerCode: params.partnerCode,
        credentialCode: params.credentialCode,
      }
    : getGlobePayConfig();
  const time = Date.now();
  const nonceStr = createNonceStr();
  const sign = signGlobePayRequest({
    partnerCode: config.partnerCode,
    time,
    nonceStr,
    credentialCode: config.credentialCode,
  });
  const search = new URLSearchParams({
    time: String(time),
    nonce_str: nonceStr,
    sign,
  });
  return search.toString();
}

export function verifyGlobePayNotifySign(payload: {
  time: number | string;
  nonce_str: string;
  sign: string;
}): boolean {
  const { partnerCode, credentialCode } = getGlobePayConfig();
  const time = typeof payload.time === "string" ? Number(payload.time) : payload.time;
  if (!Number.isFinite(time) || !payload.nonce_str || !payload.sign) return false;
  const expected = signGlobePayRequest({
    partnerCode,
    time,
    nonceStr: payload.nonce_str,
    credentialCode,
  });
  return expected === payload.sign.toLowerCase();
}
