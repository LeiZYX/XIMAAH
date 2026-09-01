import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody, parseOptionalInt } from "@/lib/api";
import { buildPaginationMeta, parseListPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const subjectInclude = {
  qualification: {
    select: {
      id: true,
      name: true,
      level: true,
      examBoardId: true,
      examBoard: { select: { name: true, code: true } },
    },
  },
  _count: { select: { papers: true } },
} as const;

function buildSubjectWhere(qualificationId: string | null, examBoardId: string | null) {
  return {
    ...(qualificationId ? { qualificationId } : {}),
    ...(examBoardId ? { qualification: { examBoardId } } : {}),
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const qualificationId = params.get("qualificationId");
  const examBoardId = params.get("examBoardId");
  const paginated = params.has("page") || params.has("pageSize");
  const where = buildSubjectWhere(qualificationId, examBoardId);

  if (paginated) {
    const { page, pageSize } = parseListPagination(params);
    const total = await prisma.subject.count({ where });
    const { skip, page: safePage, totalPages, pageSize: safePageSize } = buildPaginationMeta(
      total,
      page,
      pageSize,
    );
    const subjects = await prisma.subject.findMany({
      where,
      orderBy: { name: "asc" },
      include: subjectInclude,
      skip,
      take: safePageSize,
    });
    return NextResponse.json({
      subjects,
      total,
      page: safePage,
      totalPages,
      pageSize: safePageSize,
    });
  }

  const subjects = await prisma.subject.findMany({
    where,
    orderBy: { name: "asc" },
    include: subjectInclude,
  });

  return NextResponse.json(subjects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = parseJsonBody<{ name: string; code: string; qualificationId: string }>(
    body,
    ["name", "code", "qualificationId"],
  );

  if (!data) {
    return jsonError("Name, code, and qualification are required");
  }

  const subject = await prisma.subject.create({
    data: {
      name: data.name,
      code: data.code,
      qualificationId: data.qualificationId,
    },
  });

  return NextResponse.json(subject, { status: 201 });
}
