import { NextRequest, NextResponse } from "next/server";
import type { Grade } from "@/generated/prisma/enums";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  deleteClassHomeroomTeacher,
  listClassHomeroomTeachers,
  upsertClassHomeroomTeacher,
} from "@/lib/homeroom/class-homeroom";
import { RegistrationError } from "@/lib/registrations/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GRADES = new Set(["G9", "G10", "G11", "G12"]);

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const withTeachers = request.nextUrl.searchParams.get("withTeachers") === "1";
  const rows = await listClassHomeroomTeachers();

  if (!withTeachers) {
    return NextResponse.json(rows);
  }

  const teachers = await prisma.user.findMany({
    where: { role: "SUBJECT_TEACHER", isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      teacherProfile: { select: { email: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ assignments: rows, teachers });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data = parseJsonBody<{
    grade: string;
    className: string;
    teacherUserId: string;
  }>(body, ["grade", "className", "teacherUserId"]);

  if (!data || !GRADES.has(data.grade)) {
    return jsonError("grade, className, and teacherUserId are required (grade: G9–G12)");
  }

  try {
    const row = await upsertClassHomeroomTeacher({
      grade: data.grade as Grade,
      className: data.className,
      teacherUserId: data.teacherUserId,
    });
    return NextResponse.json(row);
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return jsonError("id is required");

  try {
    await deleteClassHomeroomTeacher(id);
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError("Homeroom assignment not found", 404);
  }
}
