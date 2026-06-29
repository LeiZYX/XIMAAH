import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageExamData } from "@/lib/auth/permissions";
import {
  DataProcessorError,
  parseOxfordAqaPdf,
  validateImportPreview,
} from "@/lib/data-processor/client";

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
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("Upload a PDF as form field 'file'.");
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return jsonError("Only PDF files are supported.");
    }

    const parsed = await parseOxfordAqaPdf(file);
    const validation = await validateImportPreview({
      source: "oxfordaqa-pdf",
      rows: parsed.rows,
      meta: parsed.meta,
    });

    return NextResponse.json({ parsed, validation });
  } catch (error) {
    if (error instanceof DataProcessorError) {
      return jsonError(error.message, error.status);
    }
    console.error("Oxford AQA preview failed:", error);
    return jsonError(error instanceof Error ? error.message : "Preview failed", 500);
  }
}
