import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { requestPasswordResetForUser } from "@/lib/auth/password-reset";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return jsonError("User not found", 404);

  await requestPasswordResetForUser(user, { performedById: auth.user.id });

  return NextResponse.json({
    ok: true,
    message: "If the email exists, a reset link has been sent.",
  });
}
