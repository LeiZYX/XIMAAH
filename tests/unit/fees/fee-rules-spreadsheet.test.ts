import { describe, expect, it } from "vitest";
import { normalizeFeeRuleImportRow } from "@/lib/fees/fee-rules-spreadsheet";

describe("normalizeFeeRuleImportRow", () => {
  it("maps wide-format headers", () => {
    const row = normalizeFeeRuleImportRow({
      "Subject Code": "WPH11",
      "Normal Cost": 10,
      "Normal Sales": 12,
      "Late Cost": 20,
      "Late Sales": 24,
      "High Late Cost": 30,
      "High Late Sales": 36,
      Currency: "GBP",
    });

    expect(row.subjectCode).toBe("WPH11");
    expect(row.normalCost).toBe(10);
    expect(row.normalSales).toBe(12);
    expect(row.lateCost).toBe(20);
    expect(row.highLateCost).toBe(30);
    expect(row.currency).toBe("GBP");
  });

  it("still maps legacy entryType headers", () => {
    const row = normalizeFeeRuleImportRow({
      subjectCode: "WPH11",
      entryType: "LATE",
      costAmount: 20,
      salesAmount: 24,
      markupType: "MANUAL",
    });

    expect(row.entryType).toBe("LATE");
    expect(row.costAmount).toBe(20);
    expect(row.salesAmount).toBe(24);
  });
});
