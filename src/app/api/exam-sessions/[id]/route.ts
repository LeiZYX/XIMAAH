import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseDate, parseJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
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

  try {
    const examSession = await prisma.examSession.update({
      where: { id },
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
    return NextResponse.json(examSession);
  } catch {
    return jsonError("Could not update exam session", 404);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    await prisma.examSession.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Could not delete exam session", 404);
  }
}
