import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { canAccessAdmin, createSessionToken, sessionCookieOptions } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = parseJsonBody<{ email: string; password: string }>(body, ["email", "password"]);

    if (!data) {
      return jsonError("Email and password are required");
    }

    const email = data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
      return jsonError("Invalid email or password", 401);
    }

    if (!canAccessAdmin(user.role)) {
      return jsonError("You do not have permission to access admin", 403);
    }

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return jsonError(error instanceof Error ? error.message : "Login failed", 500);
  }
}
