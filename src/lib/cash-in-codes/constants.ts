export const CASH_IN_CODE_IMPORT_COLUMNS = [
  "Exam Board Code",
  "Qualification Level",
  "Qualification Code",
  "Subject Code",
  "Subject Name",
  "Cash-in Code",
  "Active",
  "Notes",
] as const;

export type CashInCodeImportColumn = (typeof CASH_IN_CODE_IMPORT_COLUMNS)[number];

export const CASH_IN_CODE_SAMPLE_ROW: Record<CashInCodeImportColumn, string> = {
  "Exam Board Code": "EDEXCEL",
  "Qualification Level": "IAL",
  "Qualification Code": "",
  "Subject Code": "WMA",
  "Subject Name": "Mathematics",
  "Cash-in Code": "XMA01",
  Active: "Y",
  Notes: "",
};

export function parseActiveFlag(value: string | undefined): boolean {
  const normalized = (value ?? "Y").trim().toUpperCase();
  if (!normalized) return true;
  if (["Y", "YES", "TRUE", "1", "ACTIVE"].includes(normalized)) return true;
  if (["N", "NO", "FALSE", "0", "INACTIVE"].includes(normalized)) return false;
  throw new Error(`Invalid Active value "${value}". Use Y or N.`);
}
