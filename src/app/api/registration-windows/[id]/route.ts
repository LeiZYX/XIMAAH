import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import { lockRegistrationsForWindow, ensureExpiredWindowsLocked } from "@/lib/registrations/lock";
import { assertRegistrationWindowTimingValid } from "@/lib/registrations/fee-stages";
import type { RegistrationWindowTimingSource } from "@/lib/registrations/sync-fee-stages-from-window";
import {
  mapIncludedSeries,
  registrationWindowSeriesInclude,
  validateIncludedSeriesForBoard,
} from "@/lib/registrations/included-series";
import { summarizeRegistrationWindow } from "@/lib/registrations/window-summary";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

async function syncFeeStagesFromWindow(
  windowId: string,
  window: RegistrationWindowTimingSource,
): Promise<void> {
  const stages = await prisma.registrationFeeStage.findMany({
    where: { registrationWindowId: windowId },
  });

  for (const stage of stages) {
    if (stage.stageCode === "NORMAL") {
      await prisma.registrationFeeStage.update({
        where: { id: stage.id },
        data: {
          startAt: window.studentRegistrationOpenAt,
          endAt: window.studentRegistrationCloseAt,
        },
      });
      continue;
    }

    if (stage.stageCode === "HIGH_LATE") {
      await prisma.registrationFeeStage.update({
        where: { id: stage.id },
        data: { endAt: window.registrationCloseAt },
      });
    }
  }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;

  const window = await prisma.registrationWindow.findUnique({
    where: { id },
    include: {
      ...registrationWindowSeriesInclude,
      feeStages: { orderBy: { sequence: "asc" } },
      _count: { select: { registrations: true } },
    },
  });

  if (!window) return jsonError("Registration window not found", 404);

  const summary = summarizeRegistrationWindow(window, window.feeStages);

  return NextResponse.json({
    ...window,
    includedExamSessions: mapIncludedSeries(window.includedSeries),
    studentState: summary.studentState,
    studentStateLabel: summary.studentStateLabel,
    currentFeeStage: summary.currentFeeStage,
    totalRegistrations: window._count.registrations,
  });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canManageRegistrationWindows(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const body = await request.json();
  const data = parseJsonBody<{
    title?: string;
    examBoardId?: string;
    examSeriesIds?: string[];
    studentRegistrationOpenAt?: string;
    studentRegistrationCloseAt?: string;
    registrationCloseAt?: string;
    status?: string;
    studentSelfRegistrationEnabled?: boolean;
    eoAssistedRegistrationEnabled?: boolean;
    officeOnlyRegistrationEnabled?: boolean;
    postLockAdjustmentEnabled?: boolean;
  }>(body, []);

  if (!data) return jsonError("Invalid body");

  const previous = await prisma.registrationWindow.findUnique({ where: { id } });
  if (!previous) return jsonError("Registration window not found", 404);

  const studentRegistrationOpenAt = data.studentRegistrationOpenAt
    ? new Date(data.studentRegistrationOpenAt)
    : previous.studentRegistrationOpenAt;
  const studentRegistrationCloseAt = data.studentRegistrationCloseAt
    ? new Date(data.studentRegistrationCloseAt)
    : previous.studentRegistrationCloseAt;
  const registrationCloseAt = data.registrationCloseAt
    ? new Date(data.registrationCloseAt)
    : previous.registrationCloseAt;

  assertRegistrationWindowTimingValid({
    studentRegistrationOpenAt,
    studentRegistrationCloseAt,
    registrationCloseAt,
  });

  const examBoardId =
    data.examBoardId !== undefined ? String(data.examBoardId).trim() : previous.examBoardId;
  const examSeriesIds =
    data.examSeriesIds !== undefined
      ? [...new Set(data.examSeriesIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
      : null;

  let primarySeriesId = previous.examSeriesId;
  if (examSeriesIds) {
    try {
      const seriesRows = await validateIncludedSeriesForBoard(examBoardId, examSeriesIds, (ids) =>
        prisma.examSeries.findMany({
          where: { id: { in: ids } },
          include: { examBoard: { select: { id: true, name: true, code: true } } },
        }),
      );
      primarySeriesId = seriesRows[0]!.id;
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid exam sessions", 400);
    }
  }

  if (data.examBoardId && data.examBoardId !== previous.examBoardId) {
    const board = await prisma.examBoard.findUnique({ where: { id: examBoardId } });
    if (!board) return jsonError("Exam board not found", 404);
  }

  const window = await prisma.$transaction(async (tx) => {
    if (examSeriesIds) {
      await tx.registrationWindowIncludedSeries.deleteMany({
        where: { registrationWindowId: id },
      });
    }

    return tx.registrationWindow.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        examBoardId,
        ...(examSeriesIds
          ? {
              examSeriesId: primarySeriesId,
              includedSeries: {
                create: examSeriesIds.map((examSeriesId) => ({ examSeriesId })),
              },
            }
          : {}),
        studentRegistrationOpenAt,
        studentRegistrationCloseAt,
        registrationCloseAt,
        ...(data.status
          ? { status: data.status as "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED" }
          : {}),
        ...(data.studentSelfRegistrationEnabled !== undefined
          ? { studentSelfRegistrationEnabled: data.studentSelfRegistrationEnabled }
          : {}),
        ...(data.eoAssistedRegistrationEnabled !== undefined
          ? { eoAssistedRegistrationEnabled: data.eoAssistedRegistrationEnabled }
          : {}),
        ...(data.officeOnlyRegistrationEnabled !== undefined
          ? { officeOnlyRegistrationEnabled: data.officeOnlyRegistrationEnabled }
          : {}),
        ...(data.postLockAdjustmentEnabled !== undefined
          ? { postLockAdjustmentEnabled: data.postLockAdjustmentEnabled }
          : {}),
      },
      include: {
        ...registrationWindowSeriesInclude,
        feeStages: { orderBy: { sequence: "asc" } },
      },
    });
  });

  await syncFeeStagesFromWindow(window.id, {
    studentRegistrationOpenAt: window.studentRegistrationOpenAt,
    studentRegistrationCloseAt: window.studentRegistrationCloseAt,
    registrationCloseAt: window.registrationCloseAt,
  });

  const refreshedFeeStages = await prisma.registrationFeeStage.findMany({
    where: { registrationWindowId: window.id },
    orderBy: { sequence: "asc" },
  });

  if (data.status === "CLOSED" && previous.status !== "CLOSED") {
    await lockRegistrationsForWindow(window.id, auth.user.id);
  } else {
    await ensureExpiredWindowsLocked();
  }

  const summary = summarizeRegistrationWindow(window, refreshedFeeStages);

  return NextResponse.json({
    ...window,
    feeStages: refreshedFeeStages,
    includedExamSessions: mapIncludedSeries(window.includedSeries),
    studentState: summary.studentState,
    studentStateLabel: summary.studentStateLabel,
    currentFeeStage: summary.currentFeeStage,
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  await prisma.registrationWindow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
