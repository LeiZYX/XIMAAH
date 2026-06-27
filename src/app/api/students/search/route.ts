import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER", "SUBJECT_TEACHER"]);
  if (auth.error) return auth.error;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { studentProfile: { studentNo: { contains: q, mode: "insensitive" } } },
        { studentProfile: { email: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: {
      studentProfile: true,
    },
    orderBy: { name: "asc" },
    take: 25,
  });

  return NextResponse.json(
    students.map((student) => ({
      id: student.id,
      name: student.name,
      email: student.email ?? student.studentProfile?.email ?? null,
      studentNo: student.studentProfile?.studentNo ?? null,
      grade: student.studentProfile?.currentGrade ?? null,
      className: student.studentProfile?.currentClassName ?? null,
    })),
  );
}
