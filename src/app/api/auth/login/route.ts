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
import { recordLoginFailure, recordLoginSuccess } from "@/lib/auth/login-log";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const passwordOk = user ? await verifyPassword(data.password, user.passwordHash) : false;

    if (!user || !passwordOk) {
      await recordLoginFailure({
        headers: request.headers,
        identifier: data.identifier,
        user: user
          ? { id: user.id, name: user.name, role: user.role }
          : null,
        reason: "INVALID_CREDENTIALS",
      }).catch((error) => {
        console.error("Login log failed:", error);
      });
      return jsonError("Invalid credentials", 401);
    }

    if (user.role === "STUDENT" && user.isActive === false) {
      await recordLoginFailure({
        headers: request.headers,
        identifier: data.identifier,
        user: { id: user.id, name: user.name, role: user.role },
        reason: "INACTIVE",
      }).catch((error) => {
        console.error("Login log failed:", error);
      });
      return jsonError("This account is inactive. Contact the Exams Office if you need access.", 403);
    }

    if (user.role === "STUDENT") {
      const { isStudentLoginEnabled, STUDENT_LOGIN_DISABLED_MESSAGE } = await import(
        "@/lib/features/settings"
      );
      if (!(await isStudentLoginEnabled())) {
        await recordLoginFailure({
          headers: request.headers,
          identifier: data.identifier,
          user: { id: user.id, name: user.name, role: user.role },
          reason: "FEATURE_DISABLED",
        }).catch((error) => {
          console.error("Login log failed:", error);
        });
        return jsonError(STUDENT_LOGIN_DISABLED_MESSAGE, 403);
      }
    }

    await recordLoginSuccess({
      headers: request.headers,
      identifier: data.identifier,
      user: { id: user.id, name: user.name, role: user.role },
    }).catch((error) => {
      console.error("Login log failed:", error);
    });

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
