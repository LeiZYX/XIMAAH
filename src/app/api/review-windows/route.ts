import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { logPostResultsAudit } from "@/lib/post-results/audit";
import {
  assertReviewWindowTimingValid,
  createDefaultReviewWindowServices,
} from "@/lib/post-results/review-window-services";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const reviewWindowInclude = {
  examBoard: { select: { id: true, name: true, code: true } },
  examSeries: { select: { id: true, name: true, year: true } },
  createdBy: { select: { id: true, name: true } },
  services: { orderBy: { serviceType: "asc" as const } },
  _count: {
    select: {
      reviewRequests: true,
      cashInRequests: true,
      accessToScriptRequests: true,
      certificateRequests: true,
      feeStatements: true,
    },
  },
};

export async function GET() {
  try {
    const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
    if (auth.error) return auth.error;

    const windows = await prisma.reviewWindow.findMany({
      include: reviewWindowInclude,
      orderBy: [{ openAt: "desc" }],
    });

    return NextResponse.json(windows);
  } catch (error) {
    console.error("GET /api/review-windows failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to load review windows",
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
    title: string;
    examBoardId: string;
    examSeriesId: string;
    resultsReleaseDate?: string | null;
    openAt: string;
    closeAt: string;
    status?: string;
    notes?: string | null;
  }>(body, ["title", "examBoardId", "examSeriesId", "openAt", "closeAt"]);

  if (!data) return jsonError("Missing required fields");

  const examBoardId = String(data.examBoardId).trim();
  const examSeriesId = String(data.examSeriesId).trim();
  if (!examBoardId || !examSeriesId) {
    return jsonError("Exam board and exam series are required");
  }

  const board = await prisma.examBoard.findUnique({ where: { id: examBoardId } });
  if (!board) return jsonError("Exam board not found", 404);

  const series = await prisma.examSeries.findFirst({
    where: { id: examSeriesId, examBoardId },
  });
  if (!series) return jsonError("Exam series not found for this board", 404);

  const openAt = new Date(data.openAt);
  const closeAt = new Date(data.closeAt);
  try {
    assertReviewWindowTimingValid(openAt, closeAt);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid dates", 400);
  }

  const resultsReleaseDate = data.resultsReleaseDate
    ? new Date(data.resultsReleaseDate)
    : undefined;

  const status = (data.status as "DRAFT" | "OPEN" | "CLOSED" | "LOCKED") ?? "DRAFT";

  const window = await prisma.reviewWindow.create({
    data: {
      title: data.title.trim(),
      examBoardId,
      examSeriesId,
      resultsReleaseDate,
      openAt,
      closeAt,
      status,
      notes: data.notes?.trim() || undefined,
      createdByUserId: auth.user.id,
    },
    include: reviewWindowInclude,
  });

  await createDefaultReviewWindowServices(window.id);

  await logPostResultsAudit({
    action: "REVIEW_WINDOW_CREATED",
    performedByUserId: auth.user.id,
    reviewWindowId: window.id,
    examBoardId,
    examSeriesId,
    notes: window.title,
  });

  const refreshed = await prisma.reviewWindow.findUniqueOrThrow({
    where: { id: window.id },
    include: reviewWindowInclude,
  });

  return NextResponse.json(refreshed, { status: 201 });
}
