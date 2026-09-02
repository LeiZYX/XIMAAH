import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { parseCashInCodeImportWorkbook } from "@/lib/cash-in-codes/import-parse";
import {
  commitCashInCodeImportRows,
  resolveCashInCodeImportRows,
} from "@/lib/cash-in-codes/import";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonError("multipart/form-data with file is required", 400);
  }

  const form = await request.formData();
  const file = form.get("file");
  const commit = form.get("commit") === "true";
  if (!(file instanceof File)) return jsonError("file is required", 400);
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return jsonError("Only Excel (.xlsx) files are supported", 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseCashInCodeImportWorkbook(buffer);
    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      return NextResponse.json({
        errors: parsed.errors,
        resolved: [],
        creates: 0,
        updates: 0,
        canCommit: false,
        total: 0,
      });
    }

    const { resolved, errors } = await resolveCashInCodeImportRows(parsed.rows);
    const allErrors = [...parsed.errors, ...errors];
    const creates = resolved.filter((row) => row.action === "create").length;
    const updates = resolved.filter((row) => row.action === "update").length;
    const canCommit = allErrors.length === 0 && resolved.length > 0;

    if (!commit) {
      return NextResponse.json({
        preview: resolved,
        errors: allErrors,
        creates,
        updates,
        canCommit,
        total: parsed.rows.length,
      });
    }

    if (!canCommit) {
      return jsonError("Import has validation errors", 400);
    }

    const result = await commitCashInCodeImportRows(resolved);
    return NextResponse.json({
      ...result,
      total: resolved.length,
    });
  } catch (error) {
    console.error("POST /api/cash-in-codes/import failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to import cash-in codes",
      500,
    );
  }
}
