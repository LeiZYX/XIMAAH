import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildPartnerOrderId,
  gbpToMinorUnits,
} from "@/lib/payments/globepay/orders";
import { signGlobePayRequest } from "@/lib/payments/globepay/sign";

describe("globepay sign", () => {
  it("matches sha256 hex of partner_code&time&nonce_str&credential_code", () => {
    const partnerCode = "ABCD";
    const time = 1710000000000;
    const nonceStr = "nonce123";
    const credentialCode = "secret";
    const expected = createHash("sha256")
      .update(`${partnerCode}&${time}&${nonceStr}&${credentialCode}`)
      .digest("hex")
      .toLowerCase();

    expect(
      signGlobePayRequest({
        partnerCode,
        time,
        nonceStr,
        credentialCode,
      }),
    ).toBe(expected);
  });
});

describe("payment order helpers", () => {
  it("builds stable partner order ids", () => {
    expect(
      buildPartnerOrderId({
        statementNo: "FS-2026-000123",
        channel: "Wechat",
        version: 1,
      }),
    ).toBe("PAY-FS-2026-000123-WX-v1");

    expect(
      buildPartnerOrderId({
        statementNo: "FS-2026-000123",
        channel: "Alipay",
        version: 2,
      }),
    ).toBe("PAY-FS-2026-000123-ALI-v2");
  });

  it("converts GBP to minor units", () => {
    expect(gbpToMinorUnits(125)).toBe(12500);
    expect(gbpToMinorUnits("12.34")).toBe(1234);
    expect(() => gbpToMinorUnits(0)).toThrow(/greater than zero/);
  });
});
