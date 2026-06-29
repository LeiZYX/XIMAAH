import { NextRequest, NextResponse } from "next/server";
import { KeyDateType } from "@/generated/prisma/client";
import { jsonError, parseDate, parseJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KEY_DATE_TYPES = new Set<string>(Object.values(KeyDateType));

export async function GET(request: NextRequest) {
  const examBoardId = request.nextUrl.searchParams.get("examBoardId");
  const subjectId = request.nextUrl.searchParams.get("subjectId");
  const examSeriesId = request.nextUrl.searchParams.get("examSeriesId");

  const keyDates = await prisma.keyDate.findMany({
    where: {
      ...(examBoardId ? { examBoardId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(examSeriesId ? { examSeriesId } : {}),
    },
    orderBy: { date: "asc" },
    include: {
      examBoard: { select: { id: true, name: true, code: true } },
      subject: { select: { id: true, name: true, code: true } },
      examSeries: { select: { id: true, name: true, year: true } },
    },
  });

  return NextResponse.json(keyDates);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = parseJsonBody<{
    title: string;
    date: string;
    type?: string;
    description?: string;
    examBoardId?: string;
    subjectId?: string;
    examSeriesId?: string;
  }>(body, ["title", "date"]);

  if (!data) {
    return jsonError("Title and date are required");
  }

  const date = parseDate(data.date);
  if (!date) {
    return jsonError("Invalid date");
  }

  const type =
    data.type && KEY_DATE_TYPES.has(data.type)
      ? (data.type as KeyDateType)
      : KeyDateType.OTHER;

  const keyDate = await prisma.keyDate.create({
    data: {
      title: data.title,
      date,
      type,
      description: data.description ? String(data.description) : null,
      examBoardId: data.examBoardId || null,
      subjectId: data.subjectId || null,
      examSeriesId: data.examSeriesId || null,
    },
  });

  return NextResponse.json(keyDate, { status: 201 });
}
