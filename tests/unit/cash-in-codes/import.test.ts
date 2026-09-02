import { describe, expect, it } from "vitest";
import { parseActiveFlag } from "@/lib/cash-in-codes/constants";
import { parseCashInCodeImportWorkbook } from "@/lib/cash-in-codes/import-parse";
import { buildCashInCodeImportTemplateBuffer } from "@/lib/cash-in-codes/template";

describe("parseActiveFlag", () => {
  it("defaults blank to active", () => {
    expect(parseActiveFlag("")).toBe(true);
    expect(parseActiveFlag(undefined)).toBe(true);
  });

  it("parses yes/no values", () => {
    expect(parseActiveFlag("Y")).toBe(true);
    expect(parseActiveFlag("n")).toBe(false);
  });
});

describe("cash-in code template and parse", () => {
  it("builds a workbook that can be parsed back", () => {
    const buffer = buildCashInCodeImportTemplateBuffer([
      {
        "Exam Board Code": "EDEXCEL",
        "Qualification Level": "IAL",
        "Qualification Code": "IAL",
        "Subject Code": "WMA",
        "Subject Name": "Mathematics",
        "Cash-in Code": "XMA01",
        Active: "Y",
        Notes: "sample",
      },
    ]);

    const parsed = parseCashInCodeImportWorkbook(buffer);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      examBoardCode: "EDEXCEL",
      qualificationLevel: "IAL",
      qualificationCode: "IAL",
      subjectCode: "WMA",
      cashInCode: "XMA01",
      active: true,
      notes: "sample",
    });
  });

  it("requires qualification level or code", () => {
    const buffer = buildCashInCodeImportTemplateBuffer([
      {
        "Exam Board Code": "EDEXCEL",
        "Qualification Level": "",
        "Qualification Code": "",
        "Subject Code": "WMA",
        "Subject Name": "Mathematics",
        "Cash-in Code": "XMA01",
        Active: "Y",
        Notes: "",
      },
    ]);

    const parsed = parseCashInCodeImportWorkbook(buffer);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors[0]?.message).toContain("Qualification");
  });
});
