import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { importEdexcelRows } from "@/lib/edexcel/importer";
import { filterEdexcelRows, parseEdexcelTimetableXlsx } from "@/lib/edexcel/parser";
import {
  EDEXCEL_TIMETABLES,
  downloadEdexcelTimetable,
  getEdexcelTimetable,
} from "@/lib/edexcel/timetables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    timetables: EDEXCEL_TIMETABLES.map(({ id, label, seriesName, year, qualificationLevel }) => ({
      id,
      label,
      seriesName,
      year,
      qualificationLevel,
    })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const timetableId = typeof body.timetableId === "string" ? body.timetableId : "";
  const subjects = Array.isArray(body.subjects)
    ? body.subjects.filter((item: unknown) => typeof item === "string")
    : undefined;

  const source = getEdexcelTimetable(timetableId);
  if (!source) {
    return jsonError("Unknown Edexcel timetable. Use GET to list available timetables.");
  }

  try {
    const buffer = await downloadEdexcelTimetable(source.url);
    const parsed = parseEdexcelTimetableXlsx(buffer);
    const rows = filterEdexcelRows(parsed, subjects);

    if (rows.length === 0) {
      return jsonError("No exam rows found after parsing (check subject filter).");
    }

    const result = await importEdexcelRows(source, rows);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Edexcel import failed";
    return jsonError(message, 500);
  }
}
