import { prisma } from "@/lib/prisma";

export interface TimetableImportRow {
  date: string;
  qualificationLevel: string;
  syllabusCode: string;
  paperCode: string;
  subject: string;
  title: string;
  startTime: string;
  durationMinutes: number | null;
}

export interface TimetableImportMeta {
  seriesName: string;
  year: number;
}

export interface TimetableImportResult {
  source: string;
  rowsParsed: number;
  qualifications: number;
  subjects: number;
  papers: number;
  examSessions: number;
  skippedSessions: number;
  errors: string[];
}

const BOARD_DEFAULTS: Record<
  string,
  { name: string; country: string; region: string; timezone: string; website: string }
> = {
  CIE: {
    name: "Cambridge International",
    country: "GB",
    region: "International",
    timezone: "Europe/London",
    website: "https://www.cambridgeinternational.org",
  },
  OXFORDAQA: {
    name: "Oxford AQA",
    country: "GB",
    region: "United Kingdom",
    timezone: "Europe/London",
    website: "https://www.oxfordaqa.com",
  },
  EDEXCEL: {
    name: "Edexcel (Pearson)",
    country: "GB",
    region: "United Kingdom",
    timezone: "Europe/London",
    website: "https://qualifications.pearson.com",
  },
};

function endTimeFromDuration(startTime: string, durationMinutes: number | null): string | null {
  if (!durationMinutes) return null;
  const [hours, minutes] = startTime.split(":").map(Number);
  const total = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(total / 60) % 24;
  const endMinutes = total % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

async function ensureExamBoard(code: string) {
  const defaults = BOARD_DEFAULTS[code] ?? {
    name: code,
    country: "GB",
    region: "International",
    timezone: "Europe/London",
    website: "",
  };

  return prisma.examBoard.upsert({
    where: { code },
    update: {},
    create: {
      name: defaults.name,
      code,
      country: defaults.country,
      region: defaults.region,
      timezone: defaults.timezone,
      website: defaults.website || undefined,
      description: `${defaults.name} exam board`,
    },
  });
}

async function ensureExamSeries(examBoardId: string, meta: TimetableImportMeta) {
  const existing = await prisma.examSeries.findFirst({
    where: { examBoardId, name: meta.seriesName, year: meta.year },
  });
  if (existing) return existing;
  return prisma.examSeries.create({
    data: { examBoardId, name: meta.seriesName, year: meta.year },
  });
}

export async function importTimetableRows(
  examBoardCode: string,
  meta: TimetableImportMeta,
  rows: TimetableImportRow[],
): Promise<TimetableImportResult> {
  const result: TimetableImportResult = {
    source: `${examBoardCode} ${meta.seriesName} (${meta.year})`,
    rowsParsed: rows.length,
    qualifications: 0,
    subjects: 0,
    papers: 0,
    examSessions: 0,
    skippedSessions: 0,
    errors: [],
  };

  const examBoard = await ensureExamBoard(examBoardCode);
  const examSeries = await ensureExamSeries(examBoard.id, meta);

  const qualificationCache = new Map<string, string>();
  const subjectCache = new Map<string, string>();
  const paperCache = new Map<string, string>();
  const seenQualifications = new Set<string>();
  const seenSubjects = new Set<string>();
  const seenPapers = new Set<string>();

  for (const row of rows) {
    try {
      const qualKey = `${row.qualificationLevel}:${row.syllabusCode}`;
      let qualificationId = qualificationCache.get(qualKey);
      if (!qualificationId) {
        const existing = await prisma.qualification.findFirst({
          where: {
            examBoardId: examBoard.id,
            level: row.qualificationLevel,
            code: row.syllabusCode,
          },
        });
        qualificationId =
          existing?.id ??
          (
            await prisma.qualification.create({
              data: {
                examBoardId: examBoard.id,
                level: row.qualificationLevel,
                name: `${row.qualificationLevel} ${row.subject}`,
                code: row.syllabusCode,
              },
            })
          ).id;
        qualificationCache.set(qualKey, qualificationId);
        if (!existing) seenQualifications.add(qualificationId);
      }

      const subjectKey = `${qualificationId}:${row.syllabusCode}`;
      let subjectId = subjectCache.get(subjectKey);
      if (!subjectId) {
        const existing = await prisma.subject.findFirst({
          where: { qualificationId, code: row.syllabusCode },
        });
        subjectId =
          existing?.id ??
          (
            await prisma.subject.create({
              data: {
                qualificationId,
                name: row.subject,
                code: row.syllabusCode,
              },
            })
          ).id;
        subjectCache.set(subjectKey, subjectId);
        if (!existing) seenSubjects.add(subjectId);
      }

      const paperKey = `${subjectId}:${row.paperCode}`;
      let paperId = paperCache.get(paperKey);
      if (!paperId) {
        const existing = await prisma.paper.findFirst({
          where: { subjectId, code: row.paperCode },
        });
        paperId =
          existing?.id ??
          (
            await prisma.paper.create({
              data: {
                subjectId,
                code: row.paperCode,
                title: row.title,
                duration: row.durationMinutes,
              },
            })
          ).id;
        paperCache.set(paperKey, paperId);
        if (!existing) seenPapers.add(paperId);
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
