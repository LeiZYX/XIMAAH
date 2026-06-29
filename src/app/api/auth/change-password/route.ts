import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, getSessionUser, sessionCookieOptions } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = await getSessionUser();
  if (!auth) return jsonError("Authentication required", 401);

  const body = await request.json();
  const data = parseJsonBody<{ currentPassword: string; newPassword: string }>(body, [
    "currentPassword",
    "newPassword",
  ]);

  if (!data) return jsonError("currentPassword and newPassword are required");
  if (data.newPassword.length < 8) {
    return jsonError("New password must be at least 8 characters");
  }

  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user || !(await verifyPassword(data.currentPassword, user.passwordHash))) {
    return jsonError("Current password is incorrect", 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(data.newPassword),
      mustChangePassword: false,
    },
  });

  const token = await createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: false,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieOptions(token));
  return response;
}
