import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody, parseOptionalInt } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
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

  try {
    const paper = await prisma.paper.update({
      where: { id },
      data: {
        code: data.code,
        title: data.title,
        subjectId: data.subjectId,
        duration: parseOptionalInt(data.duration),
      },
    });
    return NextResponse.json(paper);
  } catch {
    return jsonError("Could not update paper", 404);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    await prisma.paper.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Could not delete paper", 404);
  }
}
