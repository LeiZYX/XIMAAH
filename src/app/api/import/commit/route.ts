import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageExamData } from "@/lib/auth/permissions";
import { importAqaRows } from "@/lib/aqa/importer";
import { importTimetableRows } from "@/lib/import/generic-timetable-importer";
import { toImporterMeta, toImporterRows } from "@/lib/data-processor/types";
import type { ImportPreviewSource, TimetableMetaDto, TimetableRowDto } from "@/lib/data-processor/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const runtime = "nodejs";

const BOARD_BY_SOURCE: Record<ImportPreviewSource, string | null> = {
  "pearson-excel": "EDEXCEL",
  "cambridge-pdf": "CIE",
  "oxfordaqa-pdf": "OXFORDAQA",
  "aqa-pdf": "AQA",
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageExamData(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const body = await request.json();
  const source = body?.source as ImportPreviewSource | undefined;
  const rows = body?.rows as TimetableRowDto[] | undefined;
  const meta = body?.meta as TimetableMetaDto | undefined;

  if (!source || !rows?.length || !meta) {
    return jsonError("source, rows, and meta are required");
  }

  const importerRows = toImporterRows(rows);
  const importerMeta = toImporterMeta(meta);

  if (source === "aqa-pdf") {
    const result = await importAqaRows(importerMeta, importerRows);
    return NextResponse.json(result);
  }

  const boardCode = BOARD_BY_SOURCE[source] ?? meta.exam_board;
  if (!boardCode) {
    return jsonError("Unknown import source");
  }

  const result = await importTimetableRows(boardCode, importerMeta, importerRows);
  return NextResponse.json(result);
}
