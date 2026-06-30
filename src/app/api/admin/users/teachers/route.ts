import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { parseListPagination } from "@/lib/pagination";
import {
  commitTeacherImportRows,
  listTeacherIdentities,
  parseTeacherIdentityFilters,
  parseTeacherImportWorkbook,
  upsertTeacherIdentity,
  validateTeacherImportRows,
} from "@/lib/users/teacher-identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  try {
    const filters = parseTeacherIdentityFilters(request.nextUrl.searchParams);
    const { page, pageSize } = parseListPagination(request.nextUrl.searchParams);
    const result = await listTeacherIdentities(filters, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/admin/users/teachers failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load teachers",
      500,
    );
  }
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

    const rows = parseTeacherImportWorkbook(await file.arrayBuffer());
    const errors = validateTeacherImportRows(rows);
    if (!commit) {
      return NextResponse.json({ preview: rows.slice(0, 100), errors, total: rows.length });
    }
    if (errors.length > 0) return jsonError("Import has validation errors", 400);
    const result = await commitTeacherImportRows(rows, auth.user.id);
    return NextResponse.json(result);
  }

  const body = await request.json();
  const data = parseJsonBody<{
    name: string;
    email?: string;
    phone?: string;
    status?: "ACTIVE" | "INACTIVE";
    isActive?: boolean;
    subjectIds?: string[];
    grades?: string[];
    classes?: string[];
    password?: string;
  }>(body, ["name"]);

  if (!data) return jsonError("Missing required fields");
  const teacher = await upsertTeacherIdentity(auth.user.id, data);
  return NextResponse.json(teacher, { status: 201 });
}
