import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const data = parseJsonBody<{ name: string; code: string; qualificationId: string }>(
    body,
    ["name", "code", "qualificationId"],
  );

  if (!data) {
    return jsonError("Name, code, and qualification are required");
  }

  try {
    const subject = await prisma.subject.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        qualificationId: data.qualificationId,
      },
    });
    return NextResponse.json(subject);
  } catch {
    return jsonError("Could not update subject", 404);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    await prisma.subject.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Could not delete subject", 404);
  }
}
