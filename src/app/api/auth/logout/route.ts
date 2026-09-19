import { NextRequest, NextResponse } from "next/server";
import { recordLogout } from "@/lib/auth/login-log";
import { clearSessionCookieOptions, getSessionUserFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const session = await getSessionUserFromRequest(request);
  if (session) {
    const account = await prisma.user.findUnique({
      where: { id: session.id },
      select: { email: true, username: true, studentNo: true, name: true, role: true },
    });
    await recordLogout({
      headers: request.headers,
      user: {
        id: session.id,
        name: account?.name ?? session.name,
        role: account?.role ?? session.role,
      },
      identifier: account?.email || account?.username || account?.studentNo || session.email || "",
    }).catch((error) => {
      console.error("Logout log failed:", error);
    });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearSessionCookieOptions());
  return response;
}
