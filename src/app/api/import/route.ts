import { NextRequest, NextResponse } from "next/server";
import { KeyDateType } from "@/generated/prisma/client";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ImportRow {
  entity: string;
  [key: string]: string;
}

const KEY_DATE_TYPES = new Set<string>(Object.values(KeyDateType));

function parseCsv(text: string): ImportRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((header) => header.trim());
  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    const values = line.split(",").map((value) => value.trim());
    if (values.every((value) => !value)) continue;

    const row: ImportRow = { entity: "" };
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

async function resolveExamBoardId(row: ImportRow): Promise<string> {
  if (row.examBoardId) return row.examBoardId;

  const code = (row.examBoardCode || row.boardCode || row.code)?.toUpperCase();
  if (!code) throw new Error("examBoardCode or examBoardId is required");

  const board = await prisma.examBoard.findUnique({ where: { code } });
  if (!board) throw new Error(`Exam board not found: ${code}. Run db:seed first or import examboard row.`);

  return board.id;
}

async function resolveQualificationId(row: ImportRow): Promise<string> {
  if (row.qualificationId) return row.qualificationId;

  const examBoardId = await resolveExamBoardId(row);
  const level = row.level || row.qualificationLevel;
  const name = row.qualificationName || row.name;

  if (!level || !name) {
    throw new Error("qualificationId or (examBoardCode + level + name) is required");
  }

  const qualification = await prisma.qualification.findFirst({
    where: { examBoardId, level, name },
  });

  if (!qualification) {
    throw new Error(`Qualification not found: ${level} ${name}. Import qualification row first.`);
  }

  return qualification.id;
}

async function resolveSubjectId(row: ImportRow): Promise<string> {
  if (row.subjectId) return row.subjectId;

  const code = row.subjectCode || row.code;
  if (!code) throw new Error("subjectId or subjectCode is required");

  if (row.qualificationId) {
    const subject = await prisma.subject.findFirst({
      where: { qualificationId: row.qualificationId, code },
    });
    if (!subject) throw new Error(`Subject not found with code ${code}`);
    return subject.id;
  }

  const examBoardCode = (row.examBoardCode || row.boardCode)?.toUpperCase();
  if (examBoardCode) {
    const subject = await prisma.subject.findFirst({
      where: {
        code,
        qualification: { examBoard: { code: examBoardCode } },
      },
    });
    if (!subject) throw new Error(`Subject ${code} not found under board ${examBoardCode}`);
    return subject.id;
  }

  throw new Error("subjectId, or subjectCode + examBoardCode, is required");
}

async function resolvePaperId(row: ImportRow): Promise<string> {
  if (row.paperId) return row.paperId;

  const code = row.paperCode || row.code;
  if (!code) throw new Error("paperId or paperCode is required");

  const examBoardCode = (row.examBoardCode || row.boardCode)?.toUpperCase();
  const paper = await prisma.paper.findFirst({
    where: {
      code,
      ...(examBoardCode
        ? { subject: { qualification: { examBoard: { code: examBoardCode } } } }
        : {}),
    },
  });

  if (!paper) throw new Error(`Paper not found: ${code}`);
  return paper.id;
}

async function resolveExamSeriesId(row: ImportRow): Promise<string> {
  if (row.examSeriesId) return row.examSeriesId;

  const examBoardId = await resolveExamBoardId(row);
  const name = row.seriesName || row.examSeriesName || row.name;
  const year = row.year ? Number(row.year) : undefined;

  if (!name) throw new Error("examSeriesId or (examBoardCode + seriesName + year) is required");

  const examSeries = await prisma.examSeries.findFirst({
    where: {
      examBoardId,
      name,
      ...(year ? { year } : {}),
    },
  });

  if (!examSeries) {
    throw new Error(`Exam series not found: ${name}${year ? ` ${year}` : ""}`);
  }

  return examSeries.id;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const csv = typeof body.csv === "string" ? body.csv : "";

  if (!csv.trim()) {
    return jsonError("CSV content is required");
  }

  const rows = parseCsv(csv);
  if (rows.length === 0) {
    return jsonError("No data rows found in CSV");
  }

  const results = {
    created: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const entity = row.entity.toLowerCase().replace(/-/g, "_");

    try {
      switch (entity) {
        case "examboard":
        case "exam_board": {
          const code = row.code.toUpperCase();
          const existing = await prisma.examBoard.findUnique({ where: { code } });
          if (existing) {
            results.skipped += 1;
            break;
          }
          await prisma.examBoard.create({
            data: {
              name: row.name,
              code,
              country: (row.country || "GB").toUpperCase(),
              description: row.description || null,
              region: row.region || null,
              website: row.website || null,
              timezone: row.timezone || null,
            },
          });
          results.created += 1;
          break;
        }

        case "qualification": {
          const examBoardId = await resolveExamBoardId(row);
          const existing = await prisma.qualification.findFirst({
            where: { examBoardId, level: row.level, name: row.name },
          });
          if (existing) {
            results.skipped += 1;
            break;
          }
          await prisma.qualification.create({
            data: {
              name: row.name,
              level: row.level,
              code: row.code || null,
              examBoardId,
            },
          });
          results.created += 1;
          break;
        }

        case "subject": {
          const qualificationId = await resolveQualificationId(row);
          const existing = await prisma.subject.findFirst({
            where: { qualificationId, code: row.code },
          });
          if (existing) {
            results.skipped += 1;
            break;
          }
          await prisma.subject.create({
            data: {
              name: row.name,
              code: row.code,
              qualificationId,
            },
          });
          results.created += 1;
          break;
        }

        case "paper": {
          const subjectId = await resolveSubjectId(row);
          const existing = await prisma.paper.findFirst({
            where: { subjectId, code: row.code },
          });
          if (existing) {
            results.skipped += 1;
            break;
          }
          await prisma.paper.create({
            data: {
              code: row.code,
              title: row.title,
              subjectId,
              duration: row.duration ? Number(row.duration) : null,
            },
          });
          results.created += 1;
          break;
        }

        case "examseries":
        case "exam_series": {
          const examBoardId = await resolveExamBoardId(row);
          const year = Number(row.year);
          if (!row.name || !Number.isFinite(year)) {
            throw new Error("name and year are required for exam_series");
          }
          const existing = await prisma.examSeries.findFirst({
            where: { examBoardId, name: row.name, year },
          });
          if (existing) {
            results.skipped += 1;
            break;
          }
          await prisma.examSeries.create({
            data: {
              name: row.name,
              year,
              examBoardId,
              startDate: row.startDate ? new Date(row.startDate) : null,
              endDate: row.endDate ? new Date(row.endDate) : null,
            },
          });
          results.created += 1;
          break;
        }

        case "examsession":
        case "exam_session": {
          const paperId = await resolvePaperId(row);
          const examSeriesId = await resolveExamSeriesId(row);
          if (!row.date) throw new Error("date is required");

          await prisma.examSession.create({
            data: {
              date: new Date(row.date),
              paperId,
              examSeriesId,
              startTime: row.startTime || null,
              endTime: row.endTime || null,
              venue: row.venue || null,
              notes: row.notes || null,
            },
          });
          results.created += 1;
          break;
        }

        case "keydate":
        case "key_date": {
          if (!row.title || !row.date) throw new Error("title and date are required");

          const type =
            row.type && KEY_DATE_TYPES.has(row.type.toUpperCase())
              ? (row.type.toUpperCase() as KeyDateType)
              : KeyDateType.OTHER;

          let examBoardId: string | null = row.examBoardId || null;
          let subjectId: string | null = row.subjectId || null;
          let examSeriesId: string | null = row.examSeriesId || null;

          if (!examBoardId && (row.examBoardCode || row.boardCode)) {
            examBoardId = await resolveExamBoardId(row);
          }
          if (!subjectId && row.subjectCode) {
            subjectId = await resolveSubjectId(row);
          }
          if (!examSeriesId && (row.seriesName || row.year)) {
            examSeriesId = await resolveExamSeriesId(row);
          }

          await prisma.keyDate.create({
            data: {
              title: row.title,
              date: new Date(row.date),
              type,
              description: row.description || null,
              examBoardId,
              subjectId,
              examSeriesId,
            },
          });
          results.created += 1;
          break;
        }

        default:
          throw new Error(`Unknown entity type: ${row.entity}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.errors.push(`Line ${line}: ${message}`);
    }
  }

  return NextResponse.json(results);
}
