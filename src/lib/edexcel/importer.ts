import type { EdexcelTimetableSource } from "@/lib/edexcel/timetables";
import type { EdexcelTimetableRow } from "@/lib/edexcel/parser";
import { resolveTimetableSubject } from "@/lib/qualifications/timetable-import";
import { prisma } from "@/lib/prisma";

const EXAM_BOARD_CODE = "EDEXCEL";

export interface EdexcelImportResult {
  source: string;
  rowsParsed: number;
  qualifications: number;
  subjects: number;
  papers: number;
  examSessions: number;
  skippedSessions: number;
  errors: string[];
}

function endTimeFromDuration(startTime: string, durationMinutes: number | null): string | null {
  if (!durationMinutes) return null;

  const [hours, minutes] = startTime.split(":").map(Number);
  const total = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(total / 60) % 24;
  const endMinutes = total % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

async function ensureExamBoard() {
  return prisma.examBoard.upsert({
    where: { code: EXAM_BOARD_CODE },
    update: {},
    create: {
      name: "Edexcel (Pearson)",
      code: EXAM_BOARD_CODE,
      country: "GB",
      region: "United Kingdom",
      timezone: "Europe/London",
      website: "https://qualifications.pearson.com",
      description: "Pearson Edexcel qualifications",
    },
  });
}

async function ensureExamSeries(examBoardId: string, source: EdexcelTimetableSource) {
  const existing = await prisma.examSeries.findFirst({
    where: {
      examBoardId,
      name: source.seriesName,
      year: source.year,
    },
  });

  if (existing) return existing;

  return prisma.examSeries.create({
    data: {
      examBoardId,
      name: source.seriesName,
      year: source.year,
    },
  });
}

async function ensurePaper(subjectId: string, row: EdexcelTimetableRow, cache: Map<string, string>) {
  const key = `${subjectId}:${row.paperCode}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = await prisma.paper.findFirst({
    where: { subjectId, code: row.paperCode },
  });

  const paper =
    existing ??
    (await prisma.paper.create({
      data: {
        subjectId,
        code: row.paperCode,
        title: row.title,
        duration: row.durationMinutes,
      },
    }));

  cache.set(key, paper.id);
  return paper.id;
}

export async function importEdexcelRows(
  source: EdexcelTimetableSource,
  rows: EdexcelTimetableRow[],
): Promise<EdexcelImportResult> {
  const result: EdexcelImportResult = {
    source: source.label,
    rowsParsed: rows.length,
    qualifications: 0,
    subjects: 0,
    papers: 0,
    examSessions: 0,
    skippedSessions: 0,
    errors: [],
  };

  const examBoard = await ensureExamBoard();
  const examSeries = await ensureExamSeries(examBoard.id, source);

  const qualificationCache = new Map<string, string>();
  const subjectCache = new Map<string, string>();
  const paperCache = new Map<string, string>();
  const seenQualifications = new Set<string>();
  const seenSubjects = new Set<string>();
  const seenPapers = new Set<string>();

  for (const row of rows) {
    try {
      const resolution = await resolveTimetableSubject(
        examBoard.id,
        row,
        qualificationCache,
        subjectCache,
      );
      if (resolution.createdQualification) {
        seenQualifications.add(resolution.qualificationId);
      }
      if (resolution.createdSubject) {
        seenSubjects.add(resolution.subjectId);
      }

      const beforePaper = paperCache.size;
      const paperId = await ensurePaper(resolution.subjectId, row, paperCache);
      if (paperCache.size > beforePaper) {
        seenPapers.add(paperId);
      }

      const sessionDate = new Date(`${row.date}T12:00:00`);
      const duplicate = await prisma.examSession.findFirst({
        where: {
          paperId,
          examSeriesId: examSeries.id,
          date: sessionDate,
          startTime: row.startTime,
        },
      });

      if (duplicate) {
        result.skippedSessions += 1;
        continue;
      }

      await prisma.examSession.create({
        data: {
          paperId,
          examSeriesId: examSeries.id,
          date: sessionDate,
          startTime: row.startTime,
          endTime: endTimeFromDuration(row.startTime, row.durationMinutes),
          timezone: "Europe/London",
        },
      });
      result.examSessions += 1;
    } catch (error) {
      result.errors.push(
        `${row.paperCode} on ${row.date}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  result.qualifications = seenQualifications.size;
  result.subjects = seenSubjects.size;
  result.papers = seenPapers.size;

  return result;
}
