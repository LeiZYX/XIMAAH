import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseDate, parseJsonBody, parseOptionalInt } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const examBoardId = request.nextUrl.searchParams.get("examBoardId");

  const examSeries = await prisma.examSeries.findMany({
    where: examBoardId ? { examBoardId } : undefined,
    orderBy: [{ year: "desc" }, { name: "asc" }],
    include: {
      examBoard: { select: { name: true, code: true } },
      _count: { select: { examSessions: true, keyDates: true } },
    },
  });

  return NextResponse.json(examSeries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = parseJsonBody<{
    name: string;
    year: number | string;
    examBoardId: string;
    startDate?: string;
    endDate?: string;
  }>(body, ["name", "year", "examBoardId"]);

  if (!data) {
    return jsonError("Name, year, and exam board are required");
  }

  const year = parseOptionalInt(data.year);
  if (year === null) {
    return jsonError("Year must be a valid number");
  }

  const examSeries = await prisma.examSeries.create({
    data: {
      name: data.name,
      year,
      examBoardId: data.examBoardId,
      startDate: data.startDate ? parseDate(data.startDate) : null,
      endDate: data.endDate ? parseDate(data.endDate) : null,
    },
  });

  return NextResponse.json(examSeries, { status: 201 });
}
