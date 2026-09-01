import * as XLSX from "xlsx";
import { GENDER_VALUES, GRADE_VALUES } from "@/lib/students/profile-enums";

export const INTERNAL_STUDENT_IMPORT_COLUMNS = [
  "Chinese Name",
  "Preferred English Name",
  "Firstname",
  "Lastname",
  "School Student Number",
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
  "Chinese Name": "张三",
  "Preferred English Name": "Jason",
  Firstname: "San",
  Lastname: "Zhang",
  "School Student Number": "XM2500100",
  "ID Number": "110101201001011234",
  "Passport Number": "",
  Gender: "MALE",
  "Date of Birth": "2010-01-01",
  Grade: "G10",
  Class: "10A",
  Phone: "13800000001",
  Email: "zhangsan@school.edu",
};

const INSTRUCTION_LINES = [
  ["Internal Student Import — Instructions"],
  [""],
  ["Template columns (profile fields only)"],
  [
    "A Chinese Name",
    "B Preferred English Name",
    "C Firstname (= Pinyin given name / Edexcel Firstname)",
    "D Lastname (= Pinyin surname / Edexcel Lastname)",
    "E School Student Number",
    "F ID Number",
    "G Passport Number",
    "H Gender",
    "I Date of Birth",
    "J Grade",
    "K Class",
    "L Phone",
    "M Email",
  ],
  [""],
  ["Required fields"],
  [
    "Chinese Name",
    "Firstname",
    "Lastname",
    "Gender",
    "Date of Birth",
    "Grade",
    "Class",
    "Phone",
    "Email",
  ],
  [""],
  ["Optional fields"],
  ["Preferred English Name", "School Student Number", "ID Number", "Passport Number"],
  [""],
  ["Name rules"],
  ["Firstname is the pinyin given name (e.g. Zhicheng)."],
  ["Lastname is the pinyin surname (e.g. Yao)."],
  ["Preferred English Name is the English nickname (e.g. Allen)."],
  ["Display name = Preferred English Name, otherwise Firstname + Lastname."],
  ["Legacy columns still accepted as aliases: Pinyin First Name → Firstname, Pinyin Last Name → Lastname, English Name → Preferred if Preferred empty."],
  [""],
  ["Do not include in this template"],
  ["Student ID", "Candidate Number", "UCI Number", "Exam Board Candidate Number", "Centre Number"],
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
  ["Matching priority (upsert existing students)"],
  ["1. Email"],
  ["2. Phone"],
  ["3. ID Number"],
  ["4. Passport Number"],
  ["5. Chinese Name + Date of Birth"],
  [""],
  ["Notes"],
  ["Student ID (STU-YYYY-000001) is generated automatically by the system after import."],
  ["School Student Number is assigned by the school for administration (example: XM2500100)."],
  ["Board Candidate Number and UCI Number are managed separately in Candidate Board Registration."],
  ["The import uses upsert and does not delete missing students automatically."],
  ["Phone values are stored as text to preserve leading zeros."],
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
