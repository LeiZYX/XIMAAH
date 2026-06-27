import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const windows = await prisma.registrationWindow.findMany({
    include: {
      examBoard: { select: { id: true, name: true, code: true } },
      examSeries: { select: { id: true, name: true, year: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { registrations: true } },
    },
    orderBy: [{ startAt: "desc" }],
  });

  return NextResponse.json(windows);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canManageRegistrationWindows(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const body = await request.json();
  const data = parseJsonBody<{
    examBoardId: string;
    examSeriesId: string;
    title: string;
    startAt: string;
    endAt: string;
    status?: string;
  }>(body, ["examBoardId", "examSeriesId", "title", "startAt", "endAt"]);

  if (!data) return jsonError("Missing required fields");

  const window = await prisma.registrationWindow.create({
    data: {
      examBoardId: data.examBoardId,
      examSeriesId: data.examSeriesId,
      title: data.title,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      status: (data.status as "DRAFT" | "OPEN" | "CLOSED") ?? "DRAFT",
      createdById: auth.user.id,
    },
    include: {
      examBoard: { select: { id: true, name: true, code: true } },
      examSeries: { select: { id: true, name: true, year: true } },
    },
  });

  return NextResponse.json(window, { status: 201 });
}
