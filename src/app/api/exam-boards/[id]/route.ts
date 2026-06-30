import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import {
  examBoardWriteData,
  parseExamBoardCentreFields,
} from "@/lib/exam-boards/form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const examBoard = await prisma.examBoard.findUnique({ where: { id } });

  if (!examBoard) {
    return jsonError("Exam board not found", 404);
  }

  return NextResponse.json(examBoard);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const data = parseJsonBody<{
    name: string;
    code: string;
    country: string;
    description?: string;
    region?: string;
    website?: string;
    timezone?: string;
  }>(body, ["name", "code", "country"]);

  if (!data) {
    return jsonError("Name, code, and country are required");
  }

  const code = String(data.code).toUpperCase().trim();
  const centreFields = parseExamBoardCentreFields(body as Record<string, unknown>);

  try {
    const duplicate = await prisma.examBoard.findFirst({
      where: { code, NOT: { id } },
    });
    if (duplicate) {
      return jsonError(`Code "${code}" is already used by "${duplicate.name}".`, 409);
    }

    const examBoard = await prisma.examBoard.update({
      where: { id },
      data: examBoardWriteData({ ...data, ...centreFields }),
    });
    return NextResponse.json(examBoard);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return jsonError("Exam board not found", 404);
    }
    const message = error instanceof Error ? error.message : "Could not update exam board";
    return jsonError(message, 400);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    await prisma.examBoard.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Could not delete exam board", 404);
  }
}
