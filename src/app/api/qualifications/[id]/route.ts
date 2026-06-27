import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
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

  try {
    const qualification = await prisma.qualification.update({
      where: { id },
      data: {
        name: data.name,
        level: data.level,
        code: data.code ? String(data.code) : null,
        examBoardId: data.examBoardId,
      },
    });
    return NextResponse.json(qualification);
  } catch {
    return jsonError("Could not update qualification", 404);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    await prisma.qualification.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Could not delete qualification", 404);
  }
}
