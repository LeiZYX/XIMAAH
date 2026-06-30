import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { containsFilter } from "@/lib/db/string-filters";
import { parseListPagination } from "@/lib/pagination";
import { buildPaginationMeta } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const role = request.nextUrl.searchParams.get("role")?.trim();
    const { page, pageSize } = parseListPagination(request.nextUrl.searchParams);

    const where = {
      ...(role ? { role: role as "ADMIN" | "EXAM_OFFICER" | "SUBJECT_TEACHER" | "STUDENT" } : {}),
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
