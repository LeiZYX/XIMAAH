import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";
import {
  canAccessAdminArea,
  canAccessExamOffice,
  canAccessStudentArea,
  canAccessTeacherArea,
  homePathForRole,
} from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/constants";

const PUBLIC_AUTH_PATHS = [
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

const PUBLIC_GET_APIS = [
  "/api/calendar",
  "/api/calendar/events",
  "/api/exam-boards",
  "/api/qualifications",
  "/api/subjects",
  "/api/exam-series",
  "/api/exam-sessions",
  "/api/key-dates",
  "/api/papers",
  "/api/registration-windows",
];

function isPublicApi(pathname: string, method: string): boolean {
  if (PUBLIC_AUTH_PATHS.some((path) => pathname.startsWith(path))) return true;
  if (method === "GET" && PUBLIC_GET_APIS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return true;
  }
  if (method === "GET" && pathname.startsWith("/api/calendar/subject-selections")) return true;
  return false;
}

function loginRedirect(request: NextRequest, next?: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", next ?? request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

function roleGuard(request: NextRequest, role: UserRole, allowed: boolean) {
  if (allowed) return null;
  return NextResponse.redirect(new URL(homePathForRole(role), request.url));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const isProtectedPage =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/exam-office") ||
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/student") ||
    pathname.startsWith("/account") ||
    pathname === "/about" ||
    pathname === "/help";

  const isLoginPage = pathname === "/login" || pathname === "/admin/login";
  const isPublicAuthPage =
    pathname === "/forgot-password" || pathname === "/reset-password";

  const isProtectedApi =
    pathname.startsWith("/api/") && !isPublicApi(pathname, method);

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  const token = request.cookies.get("xima_session")?.value;
  const user = token ? await verifySessionToken(token) : null;

  if (isLoginPage || isPublicAuthPage) {
    if (user && isLoginPage) {
      return NextResponse.redirect(new URL(homePathForRole(user.role), request.url));
    }
    return NextResponse.next();
  }

  if (!user) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return loginRedirect(request);
  }

  if (user.mustChangePassword && !pathname.startsWith("/account/change-password")) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Password change required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/account/change-password", request.url));
  }

  if (pathname.startsWith("/admin")) {
    const denied = roleGuard(request, user.role, canAccessAdminArea(user.role));
    if (denied) return denied;
  }

  if (pathname.startsWith("/exam-office")) {
    const denied = roleGuard(request, user.role, canAccessExamOffice(user.role));
    if (denied) return denied;
  }

  if (pathname.startsWith("/teacher")) {
    const denied = roleGuard(request, user.role, canAccessTeacherArea(user.role));
    if (denied) return denied;
  }

  if (pathname.startsWith("/student")) {
    const denied = roleGuard(request, user.role, canAccessStudentArea(user.role));
    if (denied) return denied;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/exam-office/:path*",
    "/teacher/:path*",
    "/student/:path*",
    "/account/:path*",
    "/about",
    "/help",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/api/:path*",
  ],
};
