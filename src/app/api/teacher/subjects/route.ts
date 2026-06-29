import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAuth(["SUBJECT_TEACHER"]);
  if (auth.error) return auth.error;

  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacherId: auth.user.id },
    include: {
      subject: {
        include: {
          qualification: {
            select: { name: true, level: true, examBoard: { select: { code: true } } },
          },
        },
      },
    },
    orderBy: { subject: { name: "asc" } },
  });

  if (assignments.length === 0) {
    return NextResponse.json([]);
  }

  const subjects = assignments.map((assignment) => ({
    id: assignment.subject.id,
    name: assignment.subject.name,
    code: assignment.subject.code,
    qualification: {
      name: assignment.subject.qualification.name,
      level: assignment.subject.qualification.level,
      examBoardCode: assignment.subject.qualification.examBoard.code,
    },
  }));

  return NextResponse.json(subjects);
}
