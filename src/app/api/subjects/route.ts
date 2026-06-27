import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody, parseOptionalInt } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const qualificationId = request.nextUrl.searchParams.get("qualificationId");
  const examBoardId = request.nextUrl.searchParams.get("examBoardId");

  const subjects = await prisma.subject.findMany({
    where: {
      ...(qualificationId ? { qualificationId } : {}),
      ...(examBoardId ? { qualification: { examBoardId } } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      qualification: {
        select: {
          id: true,
          name: true,
          level: true,
          examBoardId: true,
          examBoard: { select: { name: true, code: true } },
        },
      },
      _count: { select: { papers: true } },
    },
  });

  return NextResponse.json(subjects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = parseJsonBody<{ name: string; code: string; qualificationId: string }>(
    body,
    ["name", "code", "qualificationId"],
  );

  if (!data) {
    return jsonError("Name, code, and qualification are required");
  }

  const subject = await prisma.subject.create({
    data: {
      name: data.name,
      code: data.code,
      qualificationId: data.qualificationId,
    },
  });

  return NextResponse.json(subject, { status: 201 });
}
