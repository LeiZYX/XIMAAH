import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageExamData } from "@/lib/auth/permissions";
import {
  DataProcessorError,
  parseCambridgePdf,
  parseOxfordAqaPdf,
  parsePearsonExcel,
  validateImportPreview,
} from "@/lib/data-processor/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const runtime = "nodejs";

async function requireAdminImport() {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return { error: auth.error };
  if (!canManageExamData(auth.user.role)) {
    return { error: jsonError("Forbidden", 403) };
  }
  return { error: null };
}

function handleProcessorError(error: unknown) {
  if (error instanceof DataProcessorError) {
    return jsonError(error.message, error.status);
  }
  console.error("Data processor proxy failed:", error);
  return jsonError(error instanceof Error ? error.message : "Data processor request failed", 500);
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminImport();
  if (gate.error) return gate.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("Upload a file as form field 'file'.");
    }

    const parsed = await parsePearsonExcel(file);
    const validation = await validateImportPreview({
      source: "pearson-excel",
      rows: parsed.rows,
      meta: parsed.meta,
    });

    return NextResponse.json({ parsed, validation });
  } catch (error) {
    return handleProcessorError(error);
  }
}
