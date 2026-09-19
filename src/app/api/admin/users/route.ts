import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { isUserRole } from "@/lib/auth/constants";
import { hashPassword } from "@/lib/auth/password";
import { validateAdminSetPassword } from "@/lib/auth/password-policy";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { containsFilter } from "@/lib/db/string-filters";
import { parseListPagination } from "@/lib/pagination";
import { buildPaginationMeta } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { logUserAudit } from "@/lib/users/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STAFF_ACCOUNT_ROLES = ["ADMIN", "EXAM_OFFICER", "FINANCE"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const role = request.nextUrl.searchParams.get("role")?.trim();
    const { page, pageSize } = parseListPagination(request.nextUrl.searchParams);

    const where = {
      ...(role && isUserRole(role) ? { role } : {}),
      ...(q
        ? {
            OR: [
              { name: containsFilter(q) },
              { email: containsFilter(q) },
              { phone: containsFilter(q) },
              { username: containsFilter(q) },
              { studentNo: containsFilter(q) },
            ],
          }
        : {}),
    };

    const total = await prisma.user.count({ where });
    const { skip, page: safePage, totalPages } = buildPaginationMeta(total, page, pageSize);

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        studentProfile: {
          select: { studentNo: true, currentGrade: true, currentClassName: true, status: true },
        },
        teacherProfile: { select: { status: true } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      skip,
      take: pageSize,
    });

    return NextResponse.json({ users, total, page: safePage, pageSize, totalPages });
  } catch (error) {
    console.error("GET /api/admin/users failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load users",
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    username?: unknown;
    email?: unknown;
    password?: unknown;
    confirmPassword?: unknown;
    role?: unknown;
  } | null;
  if (!body) return jsonError("Invalid JSON body", 400);

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const role = typeof body.role === "string" ? body.role : "";

  if (!name) return jsonError("Name is required.", 400);
  if (!username && !email) return jsonError("Enter a username or an email.", 400);
  if (!STAFF_ACCOUNT_ROLES.includes(role as (typeof STAFF_ACCOUNT_ROLES)[number])) {
    return jsonError("Choose Admin, Exam Officer, or Finance.", 400);
  }
  const passwordError = validateAdminSetPassword(password, confirmPassword);
  if (passwordError) return jsonError(passwordError, 400);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        username: username || null,
        email: email || null,
        role: role as (typeof STAFF_ACCOUNT_ROLES)[number],
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
      },
      select: { id: true, name: true, username: true, email: true, role: true },
    });
    await logUserAudit({
      action: "USER_CREATED",
      performedById: auth.user.id,
      targetUserId: user.id,
      metadata: { role: user.role, username: user.username, email: user.email },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "P2002") return jsonError("That username or email is already in use.", 409);
    console.error("POST /api/admin/users failed:", error);
    return jsonError(error instanceof Error ? error.message : "Could not create the account", 500);
  }
}
