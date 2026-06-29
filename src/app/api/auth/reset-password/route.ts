import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = parseJsonBody<{ token: string; newPassword: string }>(body, [
    "token",
    "newPassword",
  ]);

  if (!data) return jsonError("token and newPassword are required");
  if (data.newPassword.length < 8) {
    return jsonError("Password must be at least 8 characters");
  }

  const user = await consumePasswordResetToken(data.token);
  if (!user) return jsonError("Invalid or expired reset token", 400);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(data.newPassword),
      mustChangePassword: false,
    },
  });

  return NextResponse.json({ ok: true });
}
