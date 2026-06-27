import * as XLSX from "xlsx";

export interface EdexcelTimetableRow {
  date: string;
  qualificationLevel: string;
  syllabusCode: string;
  paperCode: string;
  subject: string;
  title: string;
  startTime: string;
  durationMinutes: number | null;
}

function excelSerialToIso(value: unknown): string | null {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const month = String(parsed.m).padStart(2, "0");
    const day = String(parsed.d).padStart(2, "0");
    return `${parsed.y}-${month}-${day}`;
  }

  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }

  return null;
}

function parseDuration(value: unknown): number | null {
  const text = String(value ?? "").trim();
  const match = text.match(/(\d+)\s*h\s*(\d+)\s*m/i);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizePaperCode(rawCode: string): { syllabusCode: string; paperCode: string } {
  const cleaned = rawCode.trim().replace(/\s+/g, " ");
  const parts = cleaned.split(" ");

  if (parts.length >= 2) {
    const syllabusCode = parts[0];
    const component = parts.slice(1).join("");
    return {
      syllabusCode,
      paperCode: `${syllabusCode}/${component}`,
    };
  }

  return { syllabusCode: cleaned, paperCode: cleaned };
}

function sessionStartTime(slot: string): string {
  const normalized = slot.trim().toLowerCase();
  if (normalized.includes("afternoon") || normalized.includes("pm")) {
    return "13:30";
  }
  return "09:00";
}

function headerIndex(headers: string[], names: string[]): number {
  const lower = headers.map((header) => header.trim().toLowerCase());
  for (const name of names) {
    const index = lower.indexOf(name.toLowerCase());
    if (index >= 0) return index;
  }
  return -1;
}

export function parseEdexcelTimetableXlsx(buffer: ArrayBuffer): EdexcelTimetableRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase() === "all papers") ??
    workbook.SheetNames.find((name) => name.toLowerCase().includes("all")) ??
    workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  });

  const headerRowIndex = matrix.findIndex((row) =>
    row.some((cell) => String(cell).trim().toLowerCase() === "examination code"),
  );

  if (headerRowIndex < 0) {
    throw new Error('Could not find "All papers" sheet with examination data');
  }

  const headers = matrix[headerRowIndex].map((cell) => String(cell).trim());
  const dateIdx = headerIndex(headers, ["date"]);
  const qualIdx = headerIndex(headers, ["qual", "qualification"]);
  const codeIdx = headerIndex(headers, ["examination code", "code"]);
  const subjectIdx = headerIndex(headers, ["subject"]);
  const titleIdx = headerIndex(headers, ["title"]);
  const timeIdx = headerIndex(headers, ["time"]);
  const durationIdx = headerIndex(headers, ["duration"]);

  if (dateIdx < 0 || codeIdx < 0 || subjectIdx < 0) {
    throw new Error("Edexcel timetable format not recognised");
  }

  const rows: EdexcelTimetableRow[] = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    const examinationCode = String(row[codeIdx] ?? "").trim();
    const subject = String(row[subjectIdx] ?? "").trim();

    if (!examinationCode || !subject) continue;

    const date = excelSerialToIso(row[dateIdx]);
    if (!date) continue;

    const { syllabusCode, paperCode } = normalizePaperCode(examinationCode);
    const qualificationLevel =
      qualIdx >= 0 ? String(row[qualIdx] ?? "").trim() || "GCSE" : "GCSE";

    rows.push({
      date,
      qualificationLevel,
      syllabusCode,
      paperCode,
      subject,
      title: titleIdx >= 0 ? String(row[titleIdx] ?? paperCode).trim() : paperCode,
      startTime: timeIdx >= 0 ? sessionStartTime(String(row[timeIdx] ?? "")) : "09:00",
      durationMinutes: durationIdx >= 0 ? parseDuration(row[durationIdx]) : null,
    });
  }

  return rows;
}

export function filterEdexcelRows(
  rows: EdexcelTimetableRow[],
  subjects?: string[],
): EdexcelTimetableRow[] {
  if (!subjects?.length) return rows;

  const normalized = subjects.map((subject) => subject.trim().toLowerCase());
  return rows.filter((row) => normalized.includes(row.subject.toLowerCase()));
}
