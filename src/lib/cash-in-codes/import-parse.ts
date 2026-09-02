import * as XLSX from "xlsx";
import {
  CASH_IN_CODE_IMPORT_COLUMNS,
  parseActiveFlag,
  type CashInCodeImportColumn,
} from "@/lib/cash-in-codes/constants";

export interface CashInCodeImportRow {
  rowNumber: number;
  examBoardCode: string;
  qualificationLevel: string;
  qualificationCode: string;
  subjectCode: string;
  subjectName: string;
  cashInCode: string;
  active: boolean;
  notes: string | null;
}

export interface CashInCodeImportParseError {
  rowNumber: number;
  message: string;
}

function cellString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseCashInCodeImportWorkbook(buffer: ArrayBuffer | Buffer): {
  rows: CashInCodeImportRow[];
  errors: CashInCodeImportParseError[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase().includes("cash")) ??
    workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ rowNumber: 0, message: "Workbook has no sheets" }] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    return { rows: [], errors: [{ rowNumber: 1, message: "No data rows found" }] };
  }

  const headerMap = new Map<string, CashInCodeImportColumn>();
  for (const column of CASH_IN_CODE_IMPORT_COLUMNS) {
    headerMap.set(normalizeHeader(column), column);
  }

  const firstRowKeys = Object.keys(rawRows[0] ?? {});
  const resolvedHeaders = new Map<string, CashInCodeImportColumn>();
  for (const key of firstRowKeys) {
    const mapped = headerMap.get(normalizeHeader(key));
    if (mapped) resolvedHeaders.set(key, mapped);
  }

  const required: CashInCodeImportColumn[] = [
    "Exam Board Code",
    "Subject Code",
    "Cash-in Code",
  ];
  const missingRequired = required.filter(
    (column) => ![...resolvedHeaders.values()].includes(column),
  );
  if (missingRequired.length > 0) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          message: `Missing required column(s): ${missingRequired.join(", ")}`,
        },
      ],
    };
  }

  const rows: CashInCodeImportRow[] = [];
  const errors: CashInCodeImportParseError[] = [];

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const values: Partial<Record<CashInCodeImportColumn, string>> = {};
    for (const [key, column] of resolvedHeaders) {
      values[column] = cellString(raw[key]);
    }

    const examBoardCode = values["Exam Board Code"] ?? "";
    const subjectCode = values["Subject Code"] ?? "";
    const cashInCode = values["Cash-in Code"] ?? "";
    const qualificationLevel = values["Qualification Level"] ?? "";
    const qualificationCode = values["Qualification Code"] ?? "";
    const subjectName = values["Subject Name"] ?? "";
    const notesRaw = values.Notes ?? "";

    if (!examBoardCode && !subjectCode && !cashInCode) return;

    if (!examBoardCode || !subjectCode || !cashInCode) {
      errors.push({
        rowNumber,
        message: "Exam Board Code, Subject Code, and Cash-in Code are required",
      });
      return;
    }

    try {
      rows.push({
        rowNumber,
        examBoardCode: examBoardCode.toUpperCase(),
        qualificationLevel: qualificationLevel.trim(),
        qualificationCode: qualificationCode.trim(),
        subjectCode: subjectCode.trim(),
        subjectName: subjectName.trim(),
        cashInCode: cashInCode.trim().toUpperCase(),
        active: parseActiveFlag(values.Active),
        notes: notesRaw.trim() || null,
      });
    } catch (error) {
      errors.push({
        rowNumber,
        message: error instanceof Error ? error.message : "Invalid row",
      });
    }
  });

  return { rows, errors };
}
