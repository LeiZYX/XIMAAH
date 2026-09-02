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
        orderBy: [{ qualification: { level: "asc" } }, { code: "asc" }],
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
          papers: {
            orderBy: { code: "asc" },
            select: {
              id: true,
              code: true,
              title: true,
            },
          },
        },
      }),
      getCalendarSubjectFilterState(),
    ]);

    const selections = Object.fromEntries(
      examBoards.map((board) => {
        const filter = filterState.get(board.id);
        if (filter && filter.paperIds.size > 0) {
          return [board.id, [...filter.paperIds]];
        }
        return [board.id, []];
      }),
    );

    const legacySubjectSelections = Object.fromEntries(
      examBoards.map((board) => [
        board.id,
        [...(filterState.get(board.id)?.subjectIds ?? [])],
      ]),
    );

    return NextResponse.json({
      examBoards,
      subjects,
      selections,
      legacySubjectSelections,
    });
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
    paperIds: string[];
    enabled: boolean;
  }>(body, ["examBoardId", "paperIds", "enabled"]);

  if (!data) {
    return jsonError("examBoardId, paperIds, and enabled are required");
  }

  if (!Array.isArray(data.paperIds)) {
    return jsonError("paperIds must be an array");
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

  const uniquePaperIds = [...new Set(data.paperIds.filter(Boolean))];

  if (uniquePaperIds.length > 0) {
    const validPapers = await prisma.paper.findMany({
      where: {
        id: { in: uniquePaperIds },
        subject: { qualification: { examBoardId: data.examBoardId } },
      },
      select: { id: true },
    });

    if (validPapers.length !== uniquePaperIds.length) {
      return jsonError("One or more papers do not belong to this exam board");
    }
  }

  await prisma.$transaction([
    prisma.examBoard.update({
      where: { id: data.examBoardId },
      data: { calendarSubjectFilterEnabled: data.enabled },
    }),
    prisma.calendarPaperSelection.deleteMany({
      where: { examBoardId: data.examBoardId },
    }),
    prisma.calendarSubjectSelection.deleteMany({
      where: { examBoardId: data.examBoardId },
    }),
    ...(uniquePaperIds.length > 0
      ? [
          prisma.calendarPaperSelection.createMany({
            data: uniquePaperIds.map((paperId) => ({
              examBoardId: data.examBoardId,
              paperId,
            })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({
    examBoardId: data.examBoardId,
    enabled: data.enabled,
    paperIds: uniquePaperIds,
  });
}
