export interface TimetableRowDto {
  date: string;
  qualification_level: string;
  syllabus_code: string;
  paper_code: string;
  subject: string;
  title: string;
  start_time: string;
  duration_minutes: number | null;
}

export interface TimetableMetaDto {
  series_name: string;
  year: number;
  exam_board: string;
  source_filename?: string | null;
}

export interface ParseResponseDto {
  source: string;
  rows: TimetableRowDto[];
  meta: TimetableMetaDto;
  row_count: number;
}

export interface ValidationIssueDto {
  row_index: number | null;
  severity: "error" | "warning";
  field: string | null;
  message: string;
}

export interface ImportPreviewResponseDto {
  valid: boolean;
  row_count: number;
  issues: ValidationIssueDto[];
  summary: {
    qualifications: number;
    subjects: number;
    papers: number;
    sessions: number;
  };
  ai_notes: string[];
}

export type ImportPreviewSource =
  | "pearson-excel"
  | "cambridge-pdf"
  | "oxfordaqa-pdf"
  | "aqa-pdf";

/** Normalise Python snake_case rows for existing TS importers (camelCase). */
export function toImporterRows(rows: TimetableRowDto[]) {
  return rows.map((row) => ({
    date: row.date,
    qualificationLevel: row.qualification_level,
    syllabusCode: row.syllabus_code,
    paperCode: row.paper_code,
    subject: row.subject,
    title: row.title,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
  }));
}

export function toImporterMeta(meta: TimetableMetaDto) {
  return {
    seriesName: meta.series_name,
    year: meta.year,
  };
}
