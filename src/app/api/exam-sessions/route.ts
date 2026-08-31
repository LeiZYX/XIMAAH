import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseDate, parseJsonBody } from "@/lib/api";
import { filterExamSessions, EXAM_SESSION_SEARCH_LIMIT } from "@/lib/exam-session-search";
import {
  buildExamSessionListWhere,
  listExamSessions,
} from "@/lib/exam-sessions/list";
import { validateExamSessionReferences } from "@/lib/exam-sessions/validation";
import { buildPaginationMeta, parseListPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const examSeriesId = params.get("examSeriesId");
  const paperId = params.get("paperId");
  const examBoardId = params.get("examBoardId");
  const subjectId = params.get("subjectId");
  const paperQ = params.get("paperQ")?.trim() ?? "";
  const query = params.get("q")?.trim() ?? "";
  const limitParam = params.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : Number.NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;
  const paginated = params.has("page") || params.has("pageSize");

  const where = buildExamSessionListWhere({
    examBoardId,
    examSeriesId,
    paperId,
    subjectId,
    paperQ,
  });

  if (paginated) {
    const { page, pageSize } = parseListPagination(params);
    const total = await prisma.examSession.count({ where });
    const { skip, page: safePage, totalPages, pageSize: safePageSize } = buildPaginationMeta(
      total,
      page,
      pageSize,
    );
    const sessions = await listExamSessions({ where, skip, take: safePageSize });
    return NextResponse.json({
      sessions,
      total,
      page: safePage,
      totalPages,
      pageSize: safePageSize,
    });
  }

  const examSessions = await listExamSessions({ where });

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
    examBoardId: string;
    startTime?: string;
    endTime?: string;
    venue?: string;
    notes?: string;
  }>(body, ["date", "paperId", "examSeriesId", "examBoardId"]);

  if (!data) {
    return jsonError("Date, paper, exam series, and exam board are required");
  }

  const date = parseDate(data.date);
  if (!date) {
    return jsonError("Invalid date");
  }

  const referenceError = await validateExamSessionReferences(data);
  if (referenceError) return jsonError(referenceError, 400);

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
