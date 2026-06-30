import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import {
  exportStudentIdentities,
  parseStudentIdentityFilters,
  studentRowsToWorkbook,
} from "@/lib/users/student-identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const filters = parseStudentIdentityFilters(request.nextUrl.searchParams);
  const rows = await exportStudentIdentities(filters);
  const buffer = studentRowsToWorkbook(rows);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="students.xlsx"',
    },
  });
}
