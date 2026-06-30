import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { validatePassword } from "@/lib/auth/password-policy";
import { hashPassword } from "@/lib/auth/password";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";
import { logUserAudit } from "@/lib/users/audit";
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
  const passwordError = validatePassword(data.newPassword);
  if (passwordError) return jsonError(passwordError);

  const user = await consumePasswordResetToken(data.token);
  if (!user) return jsonError("Invalid or expired reset token", 400);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(data.newPassword),
      mustChangePassword: false,
    },
  });

  await logUserAudit({
    action: "PASSWORD_RESET_COMPLETED",
    performedById: user.id,
    targetUserId: user.id,
  });

  return NextResponse.json({ ok: true });
}
