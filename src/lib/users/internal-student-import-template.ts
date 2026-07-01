import * as XLSX from "xlsx";
import { GENDER_VALUES, GRADE_VALUES } from "@/lib/students/profile-enums";

export const INTERNAL_STUDENT_IMPORT_COLUMNS = [
  "Candidate Number",
  "Chinese Name",
  "English Name",
  "Pinyin Last Name",
  "Pinyin First Name",
  "ID Number",
  "Passport Number",
  "Gender",
  "Date of Birth",
  "Grade",
  "Class",
  "Phone",
  "Email",
] as const;

const SAMPLE_ROW: Record<(typeof INTERNAL_STUDENT_IMPORT_COLUMNS)[number], string> = {
  "Candidate Number": "AH-2026-001",
  "Chinese Name": "张三",
  "English Name": "Zhang San",
  "Pinyin Last Name": "Zhang",
  "Pinyin First Name": "San",
  "ID Number": "110101201001011234",
  "Passport Number": "",
  "Gender": "MALE",
  "Date of Birth": "2010-01-01",
  Grade: "G10",
  Class: "10A",
  Phone: "13800000001",
  Email: "zhangsan@school.edu",
};

const INSTRUCTION_LINES = [
  ["Internal Student Import — Instructions"],
  [""],
  ["Required fields"],
  ["Chinese Name", "English Name", "Pinyin Last Name", "Pinyin First Name", "Gender", "Date of Birth", "Grade", "Class", "Phone", "Email"],
  [""],
  ["Optional fields"],
  ["Candidate Number", "ID Number", "Passport Number"],
  [""],
  ["Accepted Grade values"],
  [GRADE_VALUES.join(", ")],
  [""],
  ["Accepted Gender values"],
  [GENDER_VALUES.join(", ")],
  [""],
  ["Date of Birth format"],
  ["YYYY-MM-DD (example: 2010-01-01)"],
  [""],
  ["Matching priority (upsert existing candidates)"],
  ["1. Candidate Number"],
  ["2. Email"],
  ["3. Phone"],
  ["4. ID Number"],
  ["5. Passport Number"],
  [""],
  ["Notes"],
  ["The import uses upsert and does not delete missing students automatically."],
  ["Phone values are stored as text to preserve leading zeros."],
  ["Use the Gender and Grade columns on the Internal Students sheet; accepted values are listed above."],
];

export function buildInternalStudentImportTemplateBuffer(): Buffer {
  const dataSheet = XLSX.utils.aoa_to_sheet([
    [...INTERNAL_STUDENT_IMPORT_COLUMNS],
    INTERNAL_STUDENT_IMPORT_COLUMNS.map((column) => SAMPLE_ROW[column]),
  ]);

  const instructionsSheet = XLSX.utils.aoa_to_sheet(INSTRUCTION_LINES);
  instructionsSheet["!cols"] = [{ wch: 72 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Internal Students");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
