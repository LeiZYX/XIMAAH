import * as XLSX from "xlsx";

const STUDENT_SAMPLE_ROWS = [
  {
    studentNumber: "20260001",
    candidateNumber: "AH-2026-001",
    chineseName: "张三",
    englishName: "Zhang San",
    idCardNumber: "110101201001011234",
    gender: "MALE",
    email: "zhangsan@school.edu",
    phone: "13800000001",
    grade: "G10",
    className: "10A",
    status: "ACTIVE",
    studentType: "INTERNAL",
  },
  {
    studentNumber: "20260002",
    candidateNumber: "",
    chineseName: "李四",
    englishName: "Li Si",
    idCardNumber: "",
    gender: "FEMALE",
    email: "",
    phone: "13800000002",
    grade: "G10",
    className: "10B",
    status: "ACTIVE",
    studentType: "INTERNAL",
  },
];

const TEACHER_SAMPLE_ROWS = [
  {
    name: "Wang Teacher",
    email: "wang.teacher@school.edu",
    phone: "13900000001",
    subjects: "PHY, CHEM",
    grades: "G10, G11",
    classes: "10A, 11B",
    role: "SUBJECT_TEACHER",
    status: "ACTIVE",
  },
  {
    name: "Chen Teacher",
    email: "",
    phone: "13900000002",
    subjects: "MATH",
    grades: "G9",
    classes: "",
    role: "SUBJECT_TEACHER",
    status: "ACTIVE",
  },
];

function rowsToXlsxBuffer(rows: Record<string, string>[], sheetName: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildStudentImportSampleBuffer() {
  return rowsToXlsxBuffer(STUDENT_SAMPLE_ROWS, "Students");
}

export function buildTeacherImportSampleBuffer() {
  return rowsToXlsxBuffer(TEACHER_SAMPLE_ROWS, "Teachers");
}
