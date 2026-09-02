import * as XLSX from "xlsx";
import {
  AMENDMENT_ADD_HEADERS,
  AMENDMENT_ADD_SLOTS,
  AMENDMENT_REMOVE_HEADERS,
  AMENDMENT_REMOVE_SLOTS,
} from "@/lib/board-submissions/amendment/constants";
import type { AmendmentSheetRow } from "@/lib/board-submissions/amendment/types";
import { amendmentUnitCode } from "@/lib/board-submissions/entry-utils";

function addRowToArray(row: AmendmentSheetRow): (string | number)[] {
  const values: (string | number)[] = [
    "",
    row.centreNumber ?? "",
    row.candidateNumber ?? "",
    row.displayName,
  ];

  for (let index = 0; index < AMENDMENT_ADD_SLOTS; index += 1) {
    const entry = row.entries[index];
    values.push(entry?.specification ?? "");
    values.push(entry?.specOption ?? "");
  }

  if (values.length !== AMENDMENT_ADD_HEADERS.length) {
    throw new Error("Amendment add row length does not match template headers");
  }

  return values;
}

function removeRowToArray(row: AmendmentSheetRow): (string | number)[] {
  const values: (string | number)[] = [
    "",
    row.centreNumber ?? "",
    row.candidateNumber ?? "",
    row.displayName,
  ];

  for (let index = 0; index < AMENDMENT_REMOVE_SLOTS; index += 1) {
    values.push(amendmentUnitCode(row.entries[index]));
  }

  if (values.length !== AMENDMENT_REMOVE_HEADERS.length) {
    throw new Error("Amendment remove row length does not match template headers");
  }

  return values;
}

export function buildAmendmentWorkbook(input: {
  addRows: AmendmentSheetRow[];
  removeRows: AmendmentSheetRow[];
}): Buffer {
  const addSheetRows: (string | number)[][] = [[...AMENDMENT_ADD_HEADERS]];
  for (const row of input.addRows) {
    addSheetRows.push(addRowToArray(row));
  }

  const removeSheetRows: (string | number)[][] = [[...AMENDMENT_REMOVE_HEADERS]];
  for (const row of input.removeRows) {
    removeSheetRows.push(removeRowToArray(row));
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(addSheetRows), "Add");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(removeSheetRows), "Remove");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function amendmentFilename(input: { windowTitle: string; examBoardCode: string }): string {
  const safeTitle = input.windowTitle
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${input.examBoardCode}-entry-amendment-${safeTitle || "window"}.xlsx`;
}
