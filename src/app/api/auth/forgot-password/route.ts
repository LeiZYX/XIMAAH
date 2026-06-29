import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { createPasswordResetToken, sendPasswordResetEmail } from "@/lib/auth/password-reset";
import { equalsFilter } from "@/lib/db/string-filters";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = parseJsonBody<{ email: string }>(body, ["email"]);
  if (!data) return jsonError("Email is required");

  const email = data.email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: equalsFilter(email) },
  });

  if (user?.email) {
    const { token } = await createPasswordResetToken(user.id);
    await sendPasswordResetEmail(user.email, token);
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
  });
}
