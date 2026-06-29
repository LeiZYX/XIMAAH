import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const examBoardId = request.nextUrl.searchParams.get("examBoardId");

  const qualifications = await prisma.qualification.findMany({
    where: examBoardId ? { examBoardId } : undefined,
    orderBy: [{ level: "asc" }, { name: "asc" }],
    include: {
      examBoard: { select: { id: true, name: true, code: true } },
      _count: { select: { subjects: true } },
    },
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
