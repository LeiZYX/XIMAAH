import { NextResponse } from "next/server";
import { getSessionUser, clearSessionCookieOptions } from "@/lib/auth/session";
import { homePathForRole } from "@/lib/auth/permissions";
import {
  isStudentLoginEnabled,
  STUDENT_LOGIN_DISABLED_MESSAGE,
} from "@/lib/features/settings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  if (session.role === "STUDENT" && !(await isStudentLoginEnabled())) {
    const response = NextResponse.json(
      { user: null, error: STUDENT_LOGIN_DISABLED_MESSAGE },
      { status: 403 },
    );
    response.cookies.set(clearSessionCookieOptions());
    return response;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      phone: true,
      studentNo: true,
      role: true,
      mustChangePassword: true,
      studentProfile: {
        select: {
          studentNo: true,
          currentGrade: true,
          currentClassName: true,
          email: true,
          phone: true,
          status: true,
        },
      },
      candidate: {
        select: {
          chineseName: true,
          preferredEnglishName: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const { candidate, ...rest } = user;

  return NextResponse.json({
    user: {
      ...rest,
      chineseName: candidate?.chineseName ?? null,
      preferredEnglishName: candidate?.preferredEnglishName ?? null,
      homePath: homePathForRole(user.role),
    },
  });
}
