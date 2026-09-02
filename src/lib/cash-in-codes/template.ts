import * as XLSX from "xlsx";
import {
  CASH_IN_CODE_IMPORT_COLUMNS,
  CASH_IN_CODE_SAMPLE_ROW,
  type CashInCodeImportColumn,
} from "@/lib/cash-in-codes/constants";

const INSTRUCTION_LINES = [
  ["Cash-in Codes Import — Instructions"],
  [""],
  ["Required columns"],
  ["Exam Board Code", "Subject Code", "Cash-in Code"],
  [""],
  ["Qualification matching"],
  ["Provide Qualification Code and/or Qualification Level."],
  ["Qualification Code is preferred when present."],
  ["Qualification Level examples: IAS, IAL, GCSE, A Level."],
  [""],
  ["Optional columns"],
  ["Subject Name", "Active", "Notes"],
  [""],
  ["Active values"],
  ["Y / YES / TRUE / 1 = active"],
  ["N / NO / FALSE / 0 = inactive"],
  ["Blank Active defaults to Y."],
  [""],
  ["Matching rules"],
  ["Exam Board Code must match an existing exam board (e.g. EDEXCEL)."],
  ["Subject Code is matched within the resolved qualification for that board."],
  ["Existing rows with the same board + qualification + subject are updated."],
  ["Cash-in Code must be unique within an exam board."],
  [""],
  ["Important"],
  ["Create Exam Board, Qualifications, and Subjects before importing cash-in codes."],
  ["This import does not create subjects or qualifications."],
];

export function buildCashInCodeImportTemplateBuffer(
  existingRows: Array<Record<CashInCodeImportColumn, string>> = [],
): Buffer {
  const dataRows =
    existingRows.length > 0
      ? existingRows.map((row) => CASH_IN_CODE_IMPORT_COLUMNS.map((column) => row[column] ?? ""))
      : [CASH_IN_CODE_IMPORT_COLUMNS.map((column) => CASH_IN_CODE_SAMPLE_ROW[column])];

  const dataSheet = XLSX.utils.aoa_to_sheet([[...CASH_IN_CODE_IMPORT_COLUMNS], ...dataRows]);
  dataSheet["!cols"] = CASH_IN_CODE_IMPORT_COLUMNS.map((column) => ({
    wch: Math.max(column.length + 2, 18),
  }));

  const instructionsSheet = XLSX.utils.aoa_to_sheet(INSTRUCTION_LINES);
  instructionsSheet["!cols"] = [{ wch: 96 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Cash-in Codes");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
