import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { logUserAudit } from "@/lib/users/audit";
import { upsertStudentIdentity } from "@/lib/users/student-identity";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const { id } = await params;
  const body = await request.json();
  const data = parseJsonBody<{
    englishName: string;
    chineseName?: string;
    studentNumber: string;
    candidateNumber?: string;
    email?: string;
    phone?: string;
    grade: string;
    className: string;
    idCardNumber?: string;
    gender?: "MALE" | "FEMALE" | "OTHER";
    status?: "ACTIVE" | "GRADUATED" | "LEFT" | "INACTIVE";
    isActive?: boolean;
    studentType?: "INTERNAL" | "EXTERNAL";
    password?: string;
  }>(body, ["englishName", "studentNumber", "grade", "className"]);

  if (!data) return jsonError("Missing required fields");
  const student = await upsertStudentIdentity(auth.user.id, { ...data, id });
  return NextResponse.json(student);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const { id } = await params;
  const body = await request.json();
  const data = parseJsonBody<{ isActive: boolean }>(body, ["isActive"]);
  if (!data) return jsonError("isActive is required");

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: data.isActive },
  });

  if (!data.isActive) {
    await logUserAudit({
      action: "USER_DEACTIVATED",
      performedById: auth.user.id,
      targetUserId: id,
    });
  } else {
    await logUserAudit({
      action: "USER_UPDATED",
      performedById: auth.user.id,
      targetUserId: id,
      metadata: { reactivated: true },
    });
  }

  return NextResponse.json({ id: user.id, isActive: user.isActive });
}
