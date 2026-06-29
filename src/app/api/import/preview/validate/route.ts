import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageExamData } from "@/lib/auth/permissions";
import {
  DataProcessorError,
  validateImportPreview,
} from "@/lib/data-processor/client";
import type { ImportPreviewSource, TimetableMetaDto, TimetableRowDto } from "@/lib/data-processor/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageExamData(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const source = body?.source as ImportPreviewSource | undefined;
    const rows = body?.rows as TimetableRowDto[] | undefined;
    const meta = body?.meta as TimetableMetaDto | undefined;

    if (!source || !rows || !meta) {
      return jsonError("source, rows, and meta are required");
    }

    const validation = await validateImportPreview({ source, rows, meta });
    return NextResponse.json(validation);
  } catch (error) {
    if (error instanceof DataProcessorError) {
      return jsonError(error.message, error.status);
    }
    console.error("Import preview validation failed:", error);
    return jsonError(error instanceof Error ? error.message : "Validation failed", 500);
  }
}
