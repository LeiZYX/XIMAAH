import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody, parseOptionalInt } from "@/lib/api";
import { buildPaginationMeta, parseListPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const paperInclude = {
  subject: {
    select: {
      id: true,
      name: true,
      code: true,
      qualification: {
        select: {
          name: true,
          level: true,
          examBoard: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
  _count: { select: { examSessions: true } },
} as const;

function buildPaperWhere(subjectId: string | null, examBoardId: string | null) {
  return {
    ...(subjectId ? { subjectId } : {}),
    ...(examBoardId ? { subject: { qualification: { examBoardId } } } : {}),
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const subjectId = params.get("subjectId");
  const examBoardId = params.get("examBoardId");
  const paginated = params.has("page") || params.has("pageSize");
  const where = buildPaperWhere(subjectId, examBoardId);
  const orderBy = [{ subject: { name: "asc" as const } }, { code: "asc" as const }];

  if (paginated) {
    const { page, pageSize } = parseListPagination(params);
    const total = await prisma.paper.count({ where });
    const { skip, page: safePage, totalPages, pageSize: safePageSize } = buildPaginationMeta(
      total,
      page,
      pageSize,
    );
    const papers = await prisma.paper.findMany({
      where,
      orderBy,
      include: paperInclude,
      skip,
      take: safePageSize,
    });
    return NextResponse.json({
      papers,
      total,
      page: safePage,
      totalPages,
      pageSize: safePageSize,
    });
  }

  const papers = await prisma.paper.findMany({
    where,
    orderBy,
    include: paperInclude,
  });

  return NextResponse.json(papers);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = parseJsonBody<{
    code: string;
    title: string;
    subjectId: string;
    duration?: number | string;
  }>(body, ["code", "title", "subjectId"]);

  if (!data) {
    return jsonError("Code, title, and subject are required");
  }

  const paper = await prisma.paper.create({
    data: {
      code: data.code,
      title: data.title,
      subjectId: data.subjectId,
      duration: parseOptionalInt(data.duration),
    },
  });

  return NextResponse.json(paper, { status: 201 });
}
