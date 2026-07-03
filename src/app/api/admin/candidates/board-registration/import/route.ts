import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canViewAllRegistrations } from "@/lib/auth/permissions";
import {
  collectExamBoardIdentityImportErrors,
  commitExamBoardIdentityImportRows,
  isCompleteExamBoardIdentityImportRow,
  parseExamBoardIdentityImportWorkbook,
  partitionExamBoardIdentityImportErrors,
  previewExamBoardIdentityImportRows,
} from "@/lib/candidates/exam-board-identity-import";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canViewAllRegistrations(auth.user.role)) return jsonError("Forbidden", 403);

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonError("multipart/form-data with file is required", 400);
  }

  const form = await request.formData();
  const file = form.get("file");
  const commit = form.get("commit") === "true";
  if (!(file instanceof File)) return jsonError("file is required");

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return jsonError("Only Excel (.xlsx) files are supported", 400);
  }

  const buffer = await file.arrayBuffer();
  const rows = parseExamBoardIdentityImportWorkbook(buffer);
  const errors = await collectExamBoardIdentityImportErrors(buffer, rows);
  const completeRows = rows.filter(isCompleteExamBoardIdentityImportRow);

  if (!commit) {
    const preview = await previewExamBoardIdentityImportRows(completeRows);
    const identityCreates = preview.filter((item) => item.action === "create");
    const identityUpdates = preview.filter((item) => item.action === "update");
    const studentsToCreate = preview.filter((item) => item.studentAction === "create").length;
    const studentsToUpdate = preview.filter((item) => item.studentAction === "update").length;
    const { duplicates, validationErrors, blockingErrorCount, canCommit } =
      partitionExamBoardIdentityImportErrors(errors);
    return NextResponse.json({
      preview,
      creates: identityCreates,
      updates: identityUpdates,
      studentsToCreate,
      studentsToUpdate,
      identitiesToCreate: identityCreates.length,
      identitiesToUpdate: identityUpdates.length,
      skipped: [],
      errors: validationErrors,
      duplicates,
      blockingErrorCount,
      canCommit: canCommit && preview.length > 0,
      total: rows.length,
    });
  }

  if (errors.length > 0) return jsonError("Import has validation errors", 400);

  const result = await commitExamBoardIdentityImportRows(completeRows, auth.user.id);
  return NextResponse.json(result);
}
