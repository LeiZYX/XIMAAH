import { prisma } from "@/lib/prisma";
import {
  normalizeComponentCode,
  parseJsonStringArray,
  type CieOptionDef,
} from "@/lib/cie/option-match";
import { isCieExamBoard } from "@/lib/exam-boards/branch";
import { RegistrationError } from "@/lib/registrations/errors";

export type CieSyllabusOptionRecord = {
  id: string;
  examBoardId: string;
  examSeriesId: string;
  syllabusCode: string;
  syllabusTitle: string | null;
  optionCode: string;
  componentCodes: string[];
  disallowedSyllabusCodes: string[];
  subjectId: string | null;
  notes: string | null;
  active: boolean;
};

function mapOption(row: {
  id: string;
  examBoardId: string;
  examSeriesId: string;
  syllabusCode: string;
  syllabusTitle: string | null;
  optionCode: string;
  componentCodes: unknown;
  disallowedSyllabusCodes: unknown;
  subjectId: string | null;
  notes: string | null;
  active: boolean;
}): CieSyllabusOptionRecord {
  return {
    id: row.id,
    examBoardId: row.examBoardId,
    examSeriesId: row.examSeriesId,
    syllabusCode: row.syllabusCode.trim().toUpperCase(),
    syllabusTitle: row.syllabusTitle,
    optionCode: row.optionCode.trim().toUpperCase(),
    componentCodes: parseJsonStringArray(row.componentCodes).map(normalizeComponentCode),
    disallowedSyllabusCodes: parseJsonStringArray(row.disallowedSyllabusCodes).map((c) =>
      c.trim().toUpperCase(),
    ),
    subjectId: row.subjectId,
    notes: row.notes,
    active: row.active,
  };
}

export async function listCieOptionsForSeries(examSeriesId: string, activeOnly = true) {
  const rows = await prisma.cieSyllabusOption.findMany({
    where: {
      examSeriesId,
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: [{ syllabusCode: "asc" }, { optionCode: "asc" }],
  });
  return rows.map(mapOption);
}

export async function listCieOptionsForSyllabus(params: {
  examSeriesId: string;
  syllabusCode: string;
  activeOnly?: boolean;
}) {
  const rows = await prisma.cieSyllabusOption.findMany({
    where: {
      examSeriesId: params.examSeriesId,
      syllabusCode: params.syllabusCode.trim().toUpperCase(),
      ...(params.activeOnly === false ? {} : { active: true }),
    },
    orderBy: { optionCode: "asc" },
  });
  return rows.map(mapOption);
}

export function toOptionDefs(rows: CieSyllabusOptionRecord[]): CieOptionDef[] {
  return rows.map((row) => ({
    syllabusCode: row.syllabusCode,
    optionCode: row.optionCode,
    componentCodes: row.componentCodes,
  }));
}

export async function assertCieWindow(registrationWindowId: string) {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: registrationWindowId },
    include: {
      examBoard: { select: { id: true, code: true, name: true } },
      includedSeries: { select: { examSeriesId: true } },
    },
  });
  if (!window) {
    throw new RegistrationError("Registration window not found", 404);
  }
  if (!isCieExamBoard(window.examBoard.code, window.examBoard.name)) {
    throw new RegistrationError("CIE options apply only to Cambridge registration windows", 400);
  }
  return window;
}

export type CieOptionImportRow = {
  syllabusCode: string;
  syllabusTitle?: string | null;
  optionCode: string;
  componentCodes: string[];
  disallowedSyllabusCodes?: string[];
  subjectId?: string | null;
  notes?: string | null;
  active?: boolean;
};

export async function upsertCieOptionsForSeries(params: {
  examBoardId: string;
  examSeriesId: string;
  rows: CieOptionImportRow[];
}) {
  const series = await prisma.examSeries.findUnique({
    where: { id: params.examSeriesId },
    include: { examBoard: { select: { id: true, code: true, name: true } } },
  });
  if (!series) {
    throw new RegistrationError("Exam series not found", 404);
  }
  if (series.examBoardId !== params.examBoardId) {
    throw new RegistrationError("Exam series does not belong to this exam board", 400);
  }
  if (!isCieExamBoard(series.examBoard.code, series.examBoard.name)) {
    throw new RegistrationError("Option catalogue is only for Cambridge (CIE)", 400);
  }

  let upserted = 0;
  for (const row of params.rows) {
    const syllabusCode = row.syllabusCode.trim().toUpperCase();
    const optionCode = row.optionCode.trim().toUpperCase();
    if (!syllabusCode || !optionCode || row.componentCodes.length === 0) continue;

    await prisma.cieSyllabusOption.upsert({
      where: {
        examSeriesId_syllabusCode_optionCode: {
          examSeriesId: params.examSeriesId,
          syllabusCode,
          optionCode,
        },
      },
      create: {
        examBoardId: params.examBoardId,
        examSeriesId: params.examSeriesId,
        syllabusCode,
        syllabusTitle: row.syllabusTitle?.trim() || null,
        optionCode,
        componentCodes: row.componentCodes.map(normalizeComponentCode),
        disallowedSyllabusCodes: (row.disallowedSyllabusCodes ?? []).map((c) =>
          c.trim().toUpperCase(),
        ),
        subjectId: row.subjectId ?? null,
        notes: row.notes ?? null,
        active: row.active ?? true,
      },
      update: {
        syllabusTitle: row.syllabusTitle?.trim() || null,
        componentCodes: row.componentCodes.map(normalizeComponentCode),
        disallowedSyllabusCodes: (row.disallowedSyllabusCodes ?? []).map((c) =>
          c.trim().toUpperCase(),
        ),
        subjectId: row.subjectId ?? null,
        notes: row.notes ?? null,
        active: row.active ?? true,
      },
    });
    upserted += 1;
  }

  return { upserted };
}

/** Resolve Hub subject for a syllabus code within a CIE series (by subject.code). */
export async function resolveSubjectForSyllabus(params: {
  examBoardId: string;
  syllabusCode: string;
  preferredSubjectId?: string | null;
}) {
  if (params.preferredSubjectId) {
    const preferred = await prisma.subject.findUnique({
      where: { id: params.preferredSubjectId },
      include: { qualification: { select: { examBoardId: true } } },
    });
    if (preferred && preferred.qualification.examBoardId === params.examBoardId) {
      return preferred;
    }
  }

  const code = params.syllabusCode.trim().toUpperCase();
  const subjects = await prisma.subject.findMany({
    where: {
      qualification: { examBoardId: params.examBoardId },
    },
    include: { papers: { select: { id: true, code: true } } },
  });
  return subjects.find((s) => s.code.trim().toUpperCase() === code) ?? null;
}
