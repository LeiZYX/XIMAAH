import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCalendarSubjectsForExamBoard } from "@/lib/calendar-subject-selections";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const window = await prisma.registrationWindow.findUnique({
    where: { id },
    select: {
      examBoardId: true,
      examBoard: { select: { calendarSubjectFilterEnabled: true } },
    },
  });

  if (!window) return jsonError("Registration window not found", 404);

  const subjects = await getCalendarSubjectsForExamBoard(window.examBoardId);

  return NextResponse.json({
    subjects,
    filterEnabled: window.examBoard.calendarSubjectFilterEnabled,
  });
}
