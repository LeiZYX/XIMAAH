import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  isUserRole,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type UserRole,
} from "@/lib/auth/constants";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
}

interface SessionPayload {
  id?: string;
  email?: string | null;
  name?: string;
  role?: string;
  mustChangePassword?: boolean;
  exp?: number;
}

function getAuthSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "development" ? "dev-xima-auth-secret-change-me" : undefined);
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getAuthSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    const session = payload as SessionPayload;

    if (
      typeof session.id !== "string" ||
      typeof session.name !== "string" ||
      typeof session.role !== "string" ||
      !isUserRole(session.role)
    ) {
      return null;
    }

    return {
      id: session.id,
      email: typeof session.email === "string" ? session.email : null,
      name: session.name,
      role: session.role,
      mustChangePassword: Boolean(session.mustChangePassword),
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getSessionUserFromRequest(
  request: NextRequest,
): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function clearSessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

/** Backward compatibility for legacy admin-only checks */
export function canAccessAdmin(role: string): role is UserRole {
  return role === "ADMIN" || role === "EXAM_OFFICER";
}
