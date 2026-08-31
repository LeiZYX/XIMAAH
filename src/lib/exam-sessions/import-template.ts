import * as XLSX from "xlsx";

export const EXAM_SESSION_IMPORT_COLUMNS = [
  "Exam Board Code",
  "Exam Series Name",
  "Exam Series Year",
  "Paper Code",
  "Date",
  "Start Time",
  "End Time",
  "Venue",
  "Notes",
] as const;

const SAMPLE_ROW: Record<(typeof EXAM_SESSION_IMPORT_COLUMNS)[number], string> = {
  "Exam Board Code": "EDEXCEL",
  "Exam Series Name": "Summer 2026",
  "Exam Series Year": "2026",
  "Paper Code": "1MA1/1H",
  Date: "2026-05-14",
  "Start Time": "09:00",
  "End Time": "11:00",
  Venue: "Hall A",
  Notes: "",
};

const INSTRUCTION_LINES = [
  ["Exam Session Import — Instructions"],
  [""],
  ["Required columns"],
  ["Exam Board Code", "Exam Series Name", "Exam Series Year", "Paper Code", "Date"],
  [""],
  ["Optional columns"],
  ["Start Time", "End Time", "Venue", "Notes"],
  [""],
  ["Matching rules"],
  ["Exam Board Code must match an existing exam board code, such as EDEXCEL, AQA, or CIE."],
  ["Exam Series Name and Exam Series Year identify an existing series for that exam board."],
  ["Paper Code is matched within the selected exam board."],
  ["An existing session with the same board, series, paper, date, and start time is skipped."],
  [""],
  ["Date and time formats"],
  ["Date: YYYY-MM-DD (example: 2026-05-14)"],
  ["Time: HH:mm (examples: 09:00, 13:30)"],
  [""],
  ["Important"],
  ["Create the Exam Board, Exam Series, and Paper records before importing sessions."],
  ["This import creates sessions only; it does not create or update papers or exam series."],
  ["Review the import result and check the Exam Sessions list after upload."],
];

export function buildExamSessionImportTemplateBuffer(): Buffer {
  const dataSheet = XLSX.utils.aoa_to_sheet([
    [...EXAM_SESSION_IMPORT_COLUMNS],
    EXAM_SESSION_IMPORT_COLUMNS.map((column) => SAMPLE_ROW[column]),
  ]);
  dataSheet["!cols"] = EXAM_SESSION_IMPORT_COLUMNS.map((column) => ({
    wch: Math.max(column.length + 2, 18),
  }));

  const instructionsSheet = XLSX.utils.aoa_to_sheet(INSTRUCTION_LINES);
  instructionsSheet["!cols"] = [{ wch: 96 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Exam Sessions");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
