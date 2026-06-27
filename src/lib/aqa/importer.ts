import type { AqaTimetableMeta, AqaTimetableRow } from "@/lib/aqa/parser";
import { prisma } from "@/lib/prisma";

const EXAM_BOARD_CODE = "AQA";

export interface AqaImportResult {
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
      name: "AQA",
      code: EXAM_BOARD_CODE,
      country: "GB",
      region: "United Kingdom",
      timezone: "Europe/London",
      website: "https://www.aqa.org.uk",
      description: "Assessment and Qualifications Alliance",
    },
  });
}

async function ensureExamSeries(examBoardId: string, meta: AqaTimetableMeta) {
  const existing = await prisma.examSeries.findFirst({
    where: {
      examBoardId,
      name: meta.seriesName,
      year: meta.year,
    },
  });

  if (existing) return existing;

  return prisma.examSeries.create({
    data: {
      examBoardId,
      name: meta.seriesName,
      year: meta.year,
    },
  });
}

async function ensureQualification(
  examBoardId: string,
  row: AqaTimetableRow,
  cache: Map<string, string>,
) {
  const key = `${row.qualificationLevel}:${row.syllabusCode}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = await prisma.qualification.findFirst({
    where: {
      examBoardId,
      level: row.qualificationLevel,
      code: row.syllabusCode,
    },
  });

  const qualification =
    existing ??
    (await prisma.qualification.create({
      data: {
        examBoardId,
        level: row.qualificationLevel,
        name: `${row.qualificationLevel} ${row.subject}`,
        code: row.syllabusCode,
      },
    }));

  cache.set(key, qualification.id);
  return qualification.id;
}

async function ensureSubject(
  qualificationId: string,
  row: AqaTimetableRow,
  cache: Map<string, string>,
) {
  const key = `${qualificationId}:${row.syllabusCode}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = await prisma.subject.findFirst({
    where: { qualificationId, code: row.syllabusCode },
  });

  const subject =
    existing ??
    (await prisma.subject.create({
      data: {
        qualificationId,
        name: row.subject,
        code: row.syllabusCode,
      },
    }));

  cache.set(key, subject.id);
  return subject.id;
}

async function ensurePaper(subjectId: string, row: AqaTimetableRow, cache: Map<string, string>) {
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

export async function importAqaRows(
  meta: AqaTimetableMeta,
  rows: AqaTimetableRow[],
): Promise<AqaImportResult> {
  const result: AqaImportResult = {
    source: `AQA ${meta.seriesName} (${meta.year})`,
    rowsParsed: rows.length,
    qualifications: 0,
    subjects: 0,
    papers: 0,
    examSessions: 0,
    skippedSessions: 0,
    errors: [],
  };

  const examBoard = await ensureExamBoard();
  const examSeries = await ensureExamSeries(examBoard.id, meta);

  const qualificationCache = new Map<string, string>();
  const subjectCache = new Map<string, string>();
  const paperCache = new Map<string, string>();
  const seenQualifications = new Set<string>();
  const seenSubjects = new Set<string>();
  const seenPapers = new Set<string>();

  for (const row of rows) {
    try {
      const beforeQual = qualificationCache.size;
      const qualificationId = await ensureQualification(examBoard.id, row, qualificationCache);
      if (qualificationCache.size > beforeQual) {
        seenQualifications.add(qualificationId);
      }

      const beforeSubject = subjectCache.size;
      const subjectId = await ensureSubject(qualificationId, row, subjectCache);
      if (subjectCache.size > beforeSubject) {
        seenSubjects.add(subjectId);
      }

      const beforePaper = paperCache.size;
      const paperId = await ensurePaper(subjectId, row, paperCache);
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
