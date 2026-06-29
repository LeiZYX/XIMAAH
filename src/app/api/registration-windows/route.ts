import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import { assertRegistrationWindowTimingValid } from "@/lib/registrations/fee-stages";
import { summarizeRegistrationWindow } from "@/lib/registrations/window-summary";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const windows = await prisma.registrationWindow.findMany({
    include: {
      examBoard: { select: { id: true, name: true, code: true } },
      examSeries: { select: { id: true, name: true, year: true } },
      createdBy: { select: { id: true, name: true } },
      feeStages: { orderBy: { sequence: "asc" } },
      _count: { select: { registrations: true } },
    },
    orderBy: [{ studentRegistrationOpenAt: "desc" }],
  });

  const enriched = windows.map((window) => {
    const summary = summarizeRegistrationWindow(window, window.feeStages);
    return {
      ...window,
      studentState: summary.studentState,
      studentStateLabel: summary.studentStateLabel,
      currentFeeStage: summary.currentFeeStage,
      totalRegistrations: window._count.registrations,
    };
  });

  return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/registration-windows failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load registration windows",
      500,
    );
  }
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
    studentRegistrationOpenAt: string;
    studentRegistrationCloseAt: string;
    registrationCloseAt: string;
    status?: string;
  }>(body, [
    "examBoardId",
    "examSeriesId",
    "title",
    "studentRegistrationOpenAt",
    "studentRegistrationCloseAt",
    "registrationCloseAt",
  ]);

  if (!data) return jsonError("Missing required fields");

  const studentRegistrationOpenAt = new Date(data.studentRegistrationOpenAt);
  const studentRegistrationCloseAt = new Date(data.studentRegistrationCloseAt);
  const registrationCloseAt = new Date(data.registrationCloseAt);

  assertRegistrationWindowTimingValid({
    studentRegistrationOpenAt,
    studentRegistrationCloseAt,
    registrationCloseAt,
  });

  const window = await prisma.registrationWindow.create({
    data: {
      examBoardId: data.examBoardId,
      examSeriesId: data.examSeriesId,
      title: data.title,
      studentRegistrationOpenAt,
      studentRegistrationCloseAt,
      registrationCloseAt,
      status: (data.status as "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED") ?? "DRAFT",
      createdById: auth.user.id,
    },
    include: {
      examBoard: { select: { id: true, name: true, code: true } },
      examSeries: { select: { id: true, name: true, year: true } },
      feeStages: { orderBy: { sequence: "asc" } },
    },
  });

  return NextResponse.json(window, { status: 201 });
}
