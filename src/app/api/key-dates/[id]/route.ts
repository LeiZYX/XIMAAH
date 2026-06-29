import { NextRequest, NextResponse } from "next/server";
import { KeyDateType } from "@/generated/prisma/client";
import { jsonError, parseDate, parseJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

const KEY_DATE_TYPES = new Set<string>(Object.values(KeyDateType));

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
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

  try {
    const keyDate = await prisma.keyDate.update({
      where: { id },
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
    return NextResponse.json(keyDate);
  } catch {
    return jsonError("Could not update key date", 404);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    await prisma.keyDate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Could not delete key date", 404);
  }
}
