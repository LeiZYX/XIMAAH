import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseDate, parseJsonBody } from "@/lib/api";
import { filterExamSessions, EXAM_SESSION_SEARCH_LIMIT } from "@/lib/exam-session-search";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const examSeriesId = request.nextUrl.searchParams.get("examSeriesId");
  const paperId = request.nextUrl.searchParams.get("paperId");
  const examBoardId = request.nextUrl.searchParams.get("examBoardId");
  const subjectId = request.nextUrl.searchParams.get("subjectId");
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : Number.NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;

  const examSessions = await prisma.examSession.findMany({
    where: {
      ...(examSeriesId ? { examSeriesId } : {}),
      ...(paperId ? { paperId } : {}),
      ...(examBoardId ? { examSeries: { examBoardId } } : {}),
      ...(subjectId ? { paper: { subjectId } } : {}),
    },
    orderBy: { date: "asc" },
    include: {
      paper: {
        select: {
          id: true,
          code: true,
          title: true,
          subject: {
            select: {
              name: true,
              qualification: {
                select: {
                  name: true,
                  examBoard: { select: { name: true, code: true } },
                },
              },
            },
          },
        },
      },
      examSeries: { select: { id: true, name: true, year: true } },
    },
  });

  let filtered = examSessions;
  if (query) {
    filtered = filterExamSessions(examSessions, query, limit ?? EXAM_SESSION_SEARCH_LIMIT);
  } else if (limit) {
    filtered = examSessions.slice(0, limit);
  }
  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = parseJsonBody<{
    date: string;
    paperId: string;
    examSeriesId: string;
    startTime?: string;
    endTime?: string;
    venue?: string;
    notes?: string;
  }>(body, ["date", "paperId", "examSeriesId"]);

  if (!data) {
    return jsonError("Date, paper, and exam series are required");
  }

  const date = parseDate(data.date);
  if (!date) {
    return jsonError("Invalid date");
  }

  const examSession = await prisma.examSession.create({
    data: {
      date,
      paperId: data.paperId,
      examSeriesId: data.examSeriesId,
      startTime: data.startTime ? String(data.startTime) : null,
      endTime: data.endTime ? String(data.endTime) : null,
      venue: data.venue ? String(data.venue) : null,
      notes: data.notes ? String(data.notes) : null,
    },
  });

  return NextResponse.json(examSession, { status: 201 });
}
