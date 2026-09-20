import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requestPasswordResetForUser } from "@/lib/auth/password-reset";
import { equalsFilter } from "@/lib/db/string-filters";
import {
  isStudentLoginEnabled,
} from "@/lib/features/settings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = parseJsonBody<{ email: string }>(body, ["email"]);
  if (!data) return jsonError("Email is required");

  const email = data.email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: equalsFilter(email), isActive: true },
  });

  if (user?.role === "STUDENT" && !(await isStudentLoginEnabled())) {
    // Do not send a reset link; keep the same generic reply as a missing email.
    return NextResponse.json({
      ok: true,
      message: "If the email exists, a reset link has been sent.",
    });
  }

  if (user?.email) {
    await requestPasswordResetForUser(user);
  }

  return NextResponse.json({
    ok: true,
    message: "If the email exists, a reset link has been sent.",
  });
}
