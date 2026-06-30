import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { logPostResultsAudit } from "@/lib/post-results/audit";
import { assertReviewWindowTimingValid } from "@/lib/post-results/review-window-services";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

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

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;

  const window = await prisma.reviewWindow.findUnique({
    where: { id },
    include: reviewWindowInclude,
  });

  if (!window) return jsonError("Review window not found", 404);
  return NextResponse.json(window);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canManageRegistrationWindows(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const existing = await prisma.reviewWindow.findUnique({ where: { id } });
  if (!existing) return jsonError("Review window not found", 404);

  if (existing.status === "LOCKED") {
    return jsonError("Locked review windows cannot be edited", 409);
  }

  const body = await request.json();
  const data = parseJsonBody<{
    title?: string;
    examBoardId?: string;
    examSeriesId?: string;
    resultsReleaseDate?: string | null;
    openAt?: string;
    closeAt?: string;
    status?: string;
    notes?: string | null;
  }>(body, []);

  if (!data) return jsonError("Invalid request body");

  let examBoardId = existing.examBoardId;
  let examSeriesId = existing.examSeriesId;

  if (data.examBoardId) {
    const board = await prisma.examBoard.findUnique({ where: { id: data.examBoardId } });
    if (!board) return jsonError("Exam board not found", 404);
    examBoardId = data.examBoardId;
  }

  if (data.examSeriesId) {
    const series = await prisma.examSeries.findFirst({
      where: { id: data.examSeriesId, examBoardId },
    });
    if (!series) return jsonError("Exam series not found for this board", 404);
    examSeriesId = data.examSeriesId;
  }

  const openAt = data.openAt ? new Date(data.openAt) : existing.openAt;
  const closeAt = data.closeAt ? new Date(data.closeAt) : existing.closeAt;

  try {
    assertReviewWindowTimingValid(openAt, closeAt);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid dates", 400);
  }

  const nextStatus = data.status as "DRAFT" | "OPEN" | "CLOSED" | "LOCKED" | undefined;

  const updated = await prisma.reviewWindow.update({
    where: { id },
    data: {
      title: data.title?.trim() ?? undefined,
      examBoardId,
      examSeriesId,
      resultsReleaseDate:
        data.resultsReleaseDate === null
          ? null
          : data.resultsReleaseDate
            ? new Date(data.resultsReleaseDate)
            : undefined,
      openAt,
      closeAt,
      status: nextStatus,
      notes: data.notes === null ? null : data.notes?.trim(),
    },
    include: reviewWindowInclude,
  });

  await logPostResultsAudit({
    action: nextStatus === "LOCKED" ? "REVIEW_WINDOW_LOCKED" : "REVIEW_WINDOW_UPDATED",
    performedByUserId: auth.user.id,
    reviewWindowId: id,
    examBoardId,
    examSeriesId,
    notes: updated.title,
  });

  return NextResponse.json(updated);
}
