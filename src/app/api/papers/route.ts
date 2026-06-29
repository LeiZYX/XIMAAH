import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody, parseOptionalInt } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const subjectId = request.nextUrl.searchParams.get("subjectId");
  const examBoardId = request.nextUrl.searchParams.get("examBoardId");

  const papers = await prisma.paper.findMany({
    where: {
      ...(subjectId ? { subjectId } : {}),
      ...(examBoardId
        ? { subject: { qualification: { examBoardId } } }
        : {}),
    },
    orderBy: [{ subject: { name: "asc" } }, { code: "asc" }],
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
          qualification: {
            select: {
              name: true,
              level: true,
              examBoard: { select: { name: true, code: true } },
            },
          },
        },
      },
      _count: { select: { examSessions: true } },
    },
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
