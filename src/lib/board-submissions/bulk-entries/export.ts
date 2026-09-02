import * as XLSX from "xlsx";
import {
  BULK_ENTRIES_FIXED_HEADERS,
  BULK_ENTRIES_HEADERS,
  BULK_SPEC_SLOTS,
} from "@/lib/board-submissions/bulk-entries/constants";
import type { BulkEntriesCandidateRow } from "@/lib/board-submissions/bulk-entries/types";

function rowToArray(row: BulkEntriesCandidateRow): (string | number)[] {
  const values: (string | number)[] = [
    row.uciNumber ?? "",
    row.candidateNumber ?? "",
    row.firstName,
    row.lastName,
    row.gender ?? "",
    row.dateOfBirth ?? "",
    "",
    "0",
    "",
    "",
  ];

  for (let index = 0; index < BULK_SPEC_SLOTS; index += 1) {
    values.push(row.entries[index]?.specification ?? "");
  }
  for (let index = 0; index < BULK_SPEC_SLOTS; index += 1) {
    values.push(row.entries[index]?.specOption ?? "");
  }

  if (values.length !== BULK_ENTRIES_HEADERS.length) {
    throw new Error("Bulk entries row length does not match template headers");
  }

  return values;
}

export function buildBulkEntriesWorkbook(rows: BulkEntriesCandidateRow[]): Buffer {
  const sheetRows: (string | number)[][] = [[...BULK_ENTRIES_HEADERS]];
  for (const row of rows) {
    sheetRows.push(rowToArray(row));
  }

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Bulk Entries");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function bulkEntriesFilename(input: {
  windowTitle: string;
  examBoardCode: string;
  partIndex: number;
  partCount: number;
}): string {
  const safeTitle = input.windowTitle
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix =
    input.partCount > 1 ? `-part${input.partIndex}-of-${input.partCount}` : "";
  return `${input.examBoardCode}-bulk-entries-${safeTitle || "window"}${suffix}.xlsx`;
}

export const BULK_ENTRIES_TEMPLATE_COLUMN_COUNT = BULK_ENTRIES_FIXED_HEADERS.length + BULK_SPEC_SLOTS * 2;
