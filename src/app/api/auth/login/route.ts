import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { createPasswordResetToken, sendPasswordResetEmail } from "@/lib/auth/password-reset";
import { findUserByLoginIdentifier } from "@/lib/auth/resolve-user";
import {
  createSessionToken,
  getSessionUser,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { homePathForRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = parseJsonBody<{ identifier: string; password: string }>(body, [
      "identifier",
      "password",
    ]);

    if (!data) {
      return jsonError("Identifier and password are required");
    }

    const user = await findUserByLoginIdentifier(data.identifier);

    if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
      return jsonError("Invalid credentials", 401);
    }

    if (user.role === "STUDENT" && user.isActive === false) {
      return jsonError("This account is inactive. Contact the Exams Office if you need access.", 403);
    }

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        homePath: homePathForRole(user.role),
      },
    });

    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return jsonError(error instanceof Error ? error.message : "Login failed", 500);
  }
}
