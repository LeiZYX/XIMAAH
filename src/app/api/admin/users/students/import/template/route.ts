import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { buildInternalStudentImportTemplateBuffer } from "@/lib/users/internal-student-import-template";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const buffer = buildInternalStudentImportTemplateBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="internal-student-import-template.xlsx"',
    },
  });
}
