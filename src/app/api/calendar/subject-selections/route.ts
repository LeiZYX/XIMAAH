import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { getCalendarSubjectFilterState } from "@/lib/calendar-subject-selections";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [examBoards, subjects, filterState] = await Promise.all([
      prisma.examBoard.findMany({
        orderBy: { code: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
          calendarSubjectFilterEnabled: true,
        },
      }),
      prisma.subject.findMany({
        orderBy: [{ qualification: { level: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          code: true,
          qualification: {
            select: {
              id: true,
              name: true,
              level: true,
              examBoardId: true,
              examBoard: { select: { code: true } },
            },
          },
        },
      }),
      getCalendarSubjectFilterState(),
    ]);

    const selections = Object.fromEntries(
      examBoards.map((board) => [
        board.id,
        [...(filterState.get(board.id)?.subjectIds ?? [])],
      ]),
    );

    return NextResponse.json({ examBoards, subjects, selections });
  } catch (error) {
    console.error("Failed to load calendar subject selections:", error);
    return jsonError(
      error instanceof Error
        ? error.message
        : "Failed to load calendar subject settings",
      500,
    );
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const data = parseJsonBody<{
    examBoardId: string;
    subjectIds: string[];
    enabled: boolean;
  }>(body, ["examBoardId", "subjectIds", "enabled"]);

  if (!data) {
    return jsonError("examBoardId, subjectIds, and enabled are required");
  }

  if (!Array.isArray(data.subjectIds)) {
    return jsonError("subjectIds must be an array");
  }

  if (typeof data.enabled !== "boolean") {
    return jsonError("enabled must be a boolean");
  }

  const examBoard = await prisma.examBoard.findUnique({
    where: { id: data.examBoardId },
    select: { id: true },
  });

  if (!examBoard) {
    return jsonError("Exam board not found", 404);
  }

  const uniqueSubjectIds = [...new Set(data.subjectIds.filter(Boolean))];

  if (uniqueSubjectIds.length > 0) {
    const validSubjects = await prisma.subject.findMany({
      where: {
        id: { in: uniqueSubjectIds },
        qualification: { examBoardId: data.examBoardId },
      },
      select: { id: true },
    });

    if (validSubjects.length !== uniqueSubjectIds.length) {
      return jsonError("One or more subjects do not belong to this exam board");
    }
  }

  await prisma.$transaction([
    prisma.examBoard.update({
      where: { id: data.examBoardId },
      data: { calendarSubjectFilterEnabled: data.enabled },
    }),
    prisma.calendarSubjectSelection.deleteMany({
      where: { examBoardId: data.examBoardId },
    }),
    ...(uniqueSubjectIds.length > 0
      ? [
          prisma.calendarSubjectSelection.createMany({
            data: uniqueSubjectIds.map((subjectId) => ({
              examBoardId: data.examBoardId,
              subjectId,
            })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({
    examBoardId: data.examBoardId,
    enabled: data.enabled,
    subjectIds: uniqueSubjectIds,
  });
}
