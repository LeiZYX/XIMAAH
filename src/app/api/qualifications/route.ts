import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { buildPaginationMeta, parseListPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const qualificationInclude = {
  examBoard: { select: { id: true, name: true, code: true } },
  _count: { select: { subjects: true } },
} as const;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const examBoardId = params.get("examBoardId");
  const paginated = params.has("page") || params.has("pageSize");
  const where = examBoardId ? { examBoardId } : undefined;
  const orderBy = [{ level: "asc" as const }, { name: "asc" as const }];

  if (paginated) {
    const { page, pageSize } = parseListPagination(params);
    const total = await prisma.qualification.count({ where });
    const { skip, page: safePage, totalPages, pageSize: safePageSize } = buildPaginationMeta(
      total,
      page,
      pageSize,
    );
    const qualifications = await prisma.qualification.findMany({
      where,
      orderBy,
      include: qualificationInclude,
      skip,
      take: safePageSize,
    });
    return NextResponse.json({
      qualifications,
      total,
      page: safePage,
      totalPages,
      pageSize: safePageSize,
    });
  }

  const qualifications = await prisma.qualification.findMany({
    where,
    orderBy,
    include: qualificationInclude,
  });

  return NextResponse.json(qualifications);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = parseJsonBody<{
    name: string;
    level: string;
    examBoardId: string;
    code?: string;
  }>(body, ["name", "level", "examBoardId"]);

  if (!data) {
    return jsonError("Name, level, and exam board are required");
  }

  const qualification = await prisma.qualification.create({
    data: {
      name: data.name,
      level: data.level,
      code: data.code ? String(data.code) : null,
      examBoardId: data.examBoardId,
    },
  });

  return NextResponse.json(qualification, { status: 201 });
}
