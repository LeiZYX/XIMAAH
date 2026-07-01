import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { parseListPagination } from "@/lib/pagination";
import type { Gender, Grade } from "@/generated/prisma/enums";
import {
  commitInternalStudentImportRows,
  isCompleteInternalStudentImportRow,
  parseInternalStudentImportWorkbook,
  previewInternalStudentImportRows,
  validateInternalStudentImportRows,
} from "@/lib/users/internal-student-import";
import { listStudentIdentities, parseStudentIdentityFilters, upsertStudentIdentity } from "@/lib/users/student-identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const filters = parseStudentIdentityFilters(request.nextUrl.searchParams);
  const { page, pageSize } = parseListPagination(request.nextUrl.searchParams);
  const result = await listStudentIdentities(filters, page, pageSize);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const commit = form.get("commit") === "true";
    if (!(file instanceof File)) return jsonError("file is required");

    const rows = parseInternalStudentImportWorkbook(await file.arrayBuffer());
    const errors = validateInternalStudentImportRows(rows);
    const completeRows = rows.filter(isCompleteInternalStudentImportRow);
    if (!commit) {
      const preview = await previewInternalStudentImportRows(completeRows);
      const creates = preview.filter((item) => item.action === "create");
      const updates = preview.filter((item) => item.action === "update");
      return NextResponse.json({
        preview,
        creates,
        updates,
        skipped: [],
        errors,
        total: rows.length,
      });
    }
    if (errors.length > 0) return jsonError("Import has validation errors", 400);
    const result = await commitInternalStudentImportRows(completeRows, auth.user.id);
    return NextResponse.json(result);
  }

  const body = await request.json();
  const data = parseJsonBody<{
    englishName: string;
    chineseName?: string;
    pinyinLastName?: string;
    pinyinFirstName?: string;
    studentNumber?: string;
    candidateNumber?: string;
    email?: string;
    phone?: string;
    grade: Grade | string;
    className: string;
    idCardNumber?: string;
    idNumber?: string;
    passportNumber?: string;
    dateOfBirth?: string;
    gender?: Gender;
    status?: "ACTIVE" | "GRADUATED" | "LEFT" | "INACTIVE";
    isActive?: boolean;
    studentType?: "INTERNAL" | "EXTERNAL";
    password?: string;
  }>(body, ["englishName", "grade", "className"]);

  if (!data) return jsonError("Missing required fields");
  const student = await upsertStudentIdentity(auth.user.id, data);
  return NextResponse.json(student, { status: 201 });
}
