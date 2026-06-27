import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";

const PUBLIC_API_PREFIXES = ["/api/auth/login"];

function isPublicApi(pathname: string, method: string): boolean {
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  if (method === "GET" && pathname.startsWith("/api/")) {
    return true;
  }

  return false;
}

function loginRedirect(request: NextRequest) {
  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const isAdminPage = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/admin/login";
  const isProtectedApi =
    pathname.startsWith("/api/") && !isPublicApi(pathname, method);

  if (!isAdminPage && !isProtectedApi) {
    return NextResponse.next();
  }

  if (isLoginPage) {
    const token = request.cookies.get("xima_session")?.value;
    if (token) {
      const user = await verifySessionToken(token);
      if (user) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get("xima_session")?.value;
  const user = token ? await verifySessionToken(token) : null;

  if (!user) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return loginRedirect(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
