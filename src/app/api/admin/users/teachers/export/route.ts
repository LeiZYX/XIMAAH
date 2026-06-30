import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import {
  exportTeacherIdentities,
  parseTeacherIdentityFilters,
  teacherRowsToWorkbook,
} from "@/lib/users/teacher-identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const filters = parseTeacherIdentityFilters(request.nextUrl.searchParams);
  const rows = await exportTeacherIdentities(filters);
  const buffer = teacherRowsToWorkbook(rows);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="teachers.xlsx"',
    },
  });
}
