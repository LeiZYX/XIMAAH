import * as XLSX from "xlsx";
import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseDate } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageExamData } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type SpreadsheetRow = Record<string, unknown>;

function normaliseHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cellValue(row: SpreadsheetRow, ...names: string[]): unknown {
  const wanted = new Set(names.map(normaliseHeader));
  const key = Object.keys(row).find((candidate) => wanted.has(normaliseHeader(candidate)));
  return key ? row[key] : undefined;
}

function textValue(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value ?? "").trim();
}

function parseSpreadsheetDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    }
  }

  const raw = textValue(value);
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));
  }

  const parsed = parseDate(raw);
  return parsed
    ? new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()))
    : null;
}

function parseSpreadsheetTime(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }

  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1) {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const raw = textValue(value);
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageExamData(auth.user.role)) return jsonError("Forbidden", 403);

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return jsonError("Excel file is required");
  if (file.size > 10 * 1024 * 1024) return jsonError("Excel file must be 10 MB or smaller");

  let rows: SpreadsheetRow[];
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: "array",
      cellDates: true,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return jsonError("The Excel file has no worksheets");
    rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(workbook.Sheets[sheetName]!, {
      defval: "",
      raw: true,
    });
  } catch {
    return jsonError("Could not read the Excel file");
  }

  if (rows.length === 0) return jsonError("The Excel worksheet has no data rows");

  const result = {
    rowsParsed: rows.length,
    created: 0,
    skipped: 0,
    errors: [] as string[],
  };
  const boardCache = new Map<string, { id: string }>();
  const seriesCache = new Map<string, { id: string }>();
  const paperCache = new Map<string, { id: string }>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    try {
      const examBoardCode = textValue(
        cellValue(row, "Exam Board Code", "examBoardCode", "boardCode"),
      ).toUpperCase();
      const examSeriesName = textValue(
        cellValue(row, "Exam Series Name", "examSeriesName", "seriesName"),
      );
      const examSeriesYear = Number(
        textValue(cellValue(row, "Exam Series Year", "examSeriesYear", "seriesYear", "year")),
      );
      const paperCode = textValue(cellValue(row, "Paper Code", "paperCode"));
      const date = parseSpreadsheetDate(cellValue(row, "Date", "sessionDate"));
      const startTimeValue = cellValue(row, "Start Time", "startTime");
      const endTimeValue = cellValue(row, "End Time", "endTime");

      if (!examBoardCode || !examSeriesName || !Number.isInteger(examSeriesYear) || !paperCode || !date) {
        throw new Error(
          "Exam Board Code, Exam Series Name, Exam Series Year, Paper Code, and a valid Date are required",
        );
      }

      const startTime = parseSpreadsheetTime(startTimeValue);
      const endTime = parseSpreadsheetTime(endTimeValue);
      if (textValue(startTimeValue) && !startTime) {
        throw new Error("Start Time must use HH:mm");
      }
      if (textValue(endTimeValue) && !endTime) {
        throw new Error("End Time must use HH:mm");
      }

      let examBoard = boardCache.get(examBoardCode);
      if (!examBoard) {
        const found = await prisma.examBoard.findUnique({
          where: { code: examBoardCode },
          select: { id: true },
        });
        if (!found) throw new Error(`Exam board not found: ${examBoardCode}`);
        examBoard = found;
        boardCache.set(examBoardCode, examBoard);
      }

      const seriesKey = `${examBoard.id}:${examSeriesName}:${examSeriesYear}`;
      let examSeries = seriesCache.get(seriesKey);
      if (!examSeries) {
        const found = await prisma.examSeries.findFirst({
          where: {
            examBoardId: examBoard.id,
            name: examSeriesName,
            year: examSeriesYear,
          },
          select: { id: true },
        });
        if (!found) {
          throw new Error(
            `Exam series not found: ${examSeriesName} (${examSeriesYear}) under ${examBoardCode}`,
          );
        }
        examSeries = found;
        seriesCache.set(seriesKey, examSeries);
      }

      const paperKey = `${examBoard.id}:${paperCode}`;
      let paper = paperCache.get(paperKey);
      if (!paper) {
        const found = await prisma.paper.findFirst({
          where: {
            code: paperCode,
            subject: { qualification: { examBoardId: examBoard.id } },
          },
          select: { id: true },
        });
        if (!found) throw new Error(`Paper not found: ${paperCode} under ${examBoardCode}`);
        paper = found;
        paperCache.set(paperKey, paper);
      }

      const duplicate = await prisma.examSession.findFirst({
        where: {
          paperId: paper.id,
          examSeriesId: examSeries.id,
          date,
          startTime,
        },
        select: { id: true },
      });
      if (duplicate) {
        result.skipped += 1;
        continue;
      }

      await prisma.examSession.create({
        data: {
          date,
          paperId: paper.id,
          examSeriesId: examSeries.id,
          startTime,
          endTime,
          venue: textValue(cellValue(row, "Venue", "venue")) || null,
          notes: textValue(cellValue(row, "Notes", "notes")) || null,
        },
      });
      result.created += 1;
    } catch (error) {
      result.errors.push(
        `Row ${rowNumber}: ${error instanceof Error ? error.message : "Could not import row"}`,
      );
    }
  }

  return NextResponse.json(result);
}
