import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { logUserAudit } from "@/lib/users/audit";
import { upsertTeacherIdentity } from "@/lib/users/teacher-identity";
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
  const teacher = await upsertTeacherIdentity(auth.user.id, { ...data, id });
  return NextResponse.json(teacher);
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
  }

  return NextResponse.json({ id: user.id, isActive: user.isActive });
}
