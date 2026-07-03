import * as XLSX from "xlsx";
import { CANDIDATE_EXAM_IDENTITY_STATUS_OPTIONS } from "@/lib/candidates/exam-board-identity.shared";

export const EXAM_BOARD_IDENTITY_IMPORT_COLUMNS = [
  "School Student Number",
  "Exam Board",
  "Centre Number",
  "Candidate Number",
  "UCI Number",
  "Status",
  "Notes",
] as const;

const SAMPLE_ROW: Record<(typeof EXAM_BOARD_IDENTITY_IMPORT_COLUMNS)[number], string> = {
  "School Student Number": "XM2500100",
  "Exam Board": "Pearson Edexcel",
  "Centre Number": "12345",
  "Candidate Number": "A1234",
  "UCI Number": "1234567890A",
  Status: "REGISTERED",
  Notes: "Registered for May/June series",
};

const INSTRUCTION_LINES = [
  ["Candidate Board Registration Import — Instructions"],
  [""],
  ["Template columns"],
  EXAM_BOARD_IDENTITY_IMPORT_COLUMNS.map((column, index) => `${String.fromCharCode(65 + index)} ${column}`),
  [""],
  ["Required fields"],
  ["School Student Number", "Exam Board"],
  [""],
  ["Optional fields"],
  ["Centre Number", "Candidate Number", "UCI Number", "Status", "Notes"],
  [""],
  ["Matching priority (find existing candidates)"],
  ["1. School Student Number"],
  ["2. Student ID (optional — add a Student ID column to your file for secondary matching)"],
  [""],
  ["Exam Board values"],
  ["Use the board name or code, e.g. Pearson Edexcel, Edexcel, AQA, Cambridge, CIE"],
  [""],
  ["Accepted Status values"],
  [CANDIDATE_EXAM_IDENTITY_STATUS_OPTIONS.map((option) => option.value).join(", ")],
  [""],
  ["Import behaviour"],
  ["Creates a new internal student when School Student Number does not match an existing candidate."],
  ["Student ID (STU-YYYY-000001) is generated automatically for new students and cannot be imported."],
  ["Existing Student IDs are never changed during import."],
  ["School Student Number is only updated when the import row provides a different value."],
  ["Creates a new exam board identity when none exists for the candidate and board."],
  ["Updates the existing identity when one already exists."],
  ["UCI Number is only used for Pearson / Edexcel identities."],
  ["Centre Number is required for all supported boards."],
];

export function buildExamBoardIdentityImportTemplateBuffer(): Buffer {
  const dataSheet = XLSX.utils.aoa_to_sheet([
    [...EXAM_BOARD_IDENTITY_IMPORT_COLUMNS],
    EXAM_BOARD_IDENTITY_IMPORT_COLUMNS.map((column) => SAMPLE_ROW[column]),
  ]);

  const instructionsSheet = XLSX.utils.aoa_to_sheet(INSTRUCTION_LINES);
  instructionsSheet["!cols"] = [{ wch: 72 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Board Identities");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
