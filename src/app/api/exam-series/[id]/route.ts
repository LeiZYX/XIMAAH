import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseDate, parseJsonBody, parseOptionalInt } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
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

  try {
    const examSeries = await prisma.examSeries.update({
      where: { id },
      data: {
        name: data.name,
        year,
        examBoardId: data.examBoardId,
        startDate: data.startDate ? parseDate(data.startDate) : null,
        endDate: data.endDate ? parseDate(data.endDate) : null,
      },
    });
    return NextResponse.json(examSeries);
  } catch {
    return jsonError("Could not update exam series", 404);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    await prisma.examSeries.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Could not delete exam series", 404);
  }
}
