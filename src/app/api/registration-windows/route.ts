import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import {
  getCurrentAcademicYear,
  inferAcademicYearFromExamYear,
  inferAcademicYearFromRegistrationOpenAt,
  isValidAcademicYear,
  mergeAcademicYearOptions,
} from "@/lib/registrations/academic-year";
import { createInitialFeeStagesForWindow } from "@/lib/registrations/create-initial-fee-stages";
import { assertRegistrationWindowTimingValid } from "@/lib/registrations/fee-stages";
import {
  mapIncludedSeries,
  registrationWindowSeriesInclude,
  validateIncludedSeriesForBoard,
} from "@/lib/registrations/included-series";
import {
  parseRegistrationWindowListScope,
  registrationWindowScopeWhere,
} from "@/lib/registrations/window-list-scope";
import { summarizeRegistrationWindow } from "@/lib/registrations/window-summary";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function enrichWindow(
  window: Awaited<ReturnType<typeof loadWindows>>[number],
) {
  const summary = summarizeRegistrationWindow(window, window.feeStages);
  return {
    ...window,
    includedExamSessions: mapIncludedSeries(window.includedSeries),
    studentState: summary.studentState,
    studentStateLabel: summary.studentStateLabel,
    currentFeeStage: summary.currentFeeStage,
    totalRegistrations: window._count.registrations,
  };
}

const windowInclude = {
  ...registrationWindowSeriesInclude,
  createdBy: { select: { id: true, name: true } },
  feeStages: { orderBy: { sequence: "asc" as const } },
  _count: { select: { registrations: true } },
};

async function loadWindows(where: Record<string, unknown> = {}) {
  return prisma.registrationWindow.findMany({
    where,
    include: windowInclude,
    orderBy: [{ studentRegistrationOpenAt: "desc" }],
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const yearsOnly = searchParams.get("yearsOnly") === "true";
    const resolveWindowId = searchParams.get("resolveWindowId");
    const academicYearParam = searchParams.get("academicYear");
    const scope = parseRegistrationWindowListScope(searchParams.get("scope"));
    const listAllYears = searchParams.get("allYears") === "true";

    if (yearsOnly) {
      const rows = await prisma.registrationWindow.findMany({
        select: { academicYear: true },
        distinct: ["academicYear"],
        orderBy: { academicYear: "desc" },
      });
      const years = mergeAcademicYearOptions(rows.map((row) => row.academicYear));
      return NextResponse.json({ years });
    }

    if (resolveWindowId) {
      const resolved = await prisma.registrationWindow.findUnique({
        where: { id: resolveWindowId },
        select: { academicYear: true },
      });
      if (!resolved) {
        return jsonError("Registration window not found", 404);
      }
      return NextResponse.json({ academicYear: resolved.academicYear });
    }

    const where: Record<string, unknown> = {
      ...registrationWindowScopeWhere(scope),
    };

    if (academicYearParam) {
      if (!isValidAcademicYear(academicYearParam)) {
        return jsonError("Invalid academic year", 400);
      }
      where.academicYear = academicYearParam;
    } else if (!listAllYears) {
      where.academicYear = getCurrentAcademicYear();
    }

    const windows = await loadWindows(where);
    return NextResponse.json(windows.map(enrichWindow));
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
    title: string;
    academicYear?: string;
    examBoardId: string;
    studentRegistrationOpenAt: string;
    studentRegistrationCloseAt: string;
    registrationCloseAt: string;
    status?: string;
    examSeriesIds?: string[];
    examSeriesId?: string;
    lateEntryEnabled?: boolean;
    highLateEntryEnabled?: boolean;
  }>(body, [
    "title",
    "examBoardId",
    "studentRegistrationOpenAt",
    "studentRegistrationCloseAt",
    "registrationCloseAt",
  ]);

  if (!data) return jsonError("Missing required fields");

  const examBoardId = String(data.examBoardId).trim();
  if (!examBoardId) return jsonError("Exam board is required");

  const examSeriesIds = Array.isArray(data.examSeriesIds)
    ? [...new Set(data.examSeriesIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : data.examSeriesId
      ? [data.examSeriesId]
      : [];

  let seriesRows;
  try {
    seriesRows = await validateIncludedSeriesForBoard(examBoardId, examSeriesIds, (ids) =>
      prisma.examSeries.findMany({
        where: { id: { in: ids } },
        include: { examBoard: { select: { id: true, name: true, code: true } } },
        orderBy: [{ year: "desc" }, { name: "asc" }],
      }),
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid exam sessions", 400);
  }

  const board = await prisma.examBoard.findUnique({ where: { id: examBoardId } });
  if (!board) return jsonError("Exam board not found", 404);

  const studentRegistrationOpenAt = new Date(data.studentRegistrationOpenAt);
  const studentRegistrationCloseAt = new Date(data.studentRegistrationCloseAt);
  const registrationCloseAt = new Date(data.registrationCloseAt);

  assertRegistrationWindowTimingValid({
    studentRegistrationOpenAt,
    studentRegistrationCloseAt,
    registrationCloseAt,
  });

  const primarySeries = seriesRows[0]!;
  const status = (data.status as "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED") ?? "DRAFT";

  let academicYear = data.academicYear?.trim();
  if (academicYear) {
    if (!isValidAcademicYear(academicYear)) {
      return jsonError("Invalid academic year format. Use e.g. 2026/27", 400);
    }
  } else {
    const seriesYear = await prisma.examSeries.findUnique({
      where: { id: primarySeries.id },
      select: { year: true },
    });
    academicYear = seriesYear
      ? inferAcademicYearFromExamYear(seriesYear.year)
      : inferAcademicYearFromRegistrationOpenAt(studentRegistrationOpenAt);
  }

  const window = await prisma.registrationWindow.create({
    data: {
      examBoardId,
      examSeriesId: primarySeries.id,
      title: data.title,
      academicYear,
      studentRegistrationOpenAt,
      studentRegistrationCloseAt,
      registrationCloseAt,
      status,
      createdById: auth.user.id,
      includedSeries: {
        create: examSeriesIds.map((examSeriesId) => ({ examSeriesId })),
      },
    },
    include: {
      ...registrationWindowSeriesInclude,
      feeStages: { orderBy: { sequence: "asc" } },
      _count: { select: { registrations: true } },
    },
  });

  await createInitialFeeStagesForWindow(
    window.id,
    {
      studentRegistrationOpenAt,
      studentRegistrationCloseAt,
      registrationCloseAt,
    },
    {
      lateEntryEnabled: data.lateEntryEnabled ?? true,
      highLateEntryEnabled: data.highLateEntryEnabled ?? true,
    },
  );

  const refreshed = await prisma.registrationWindow.findUniqueOrThrow({
    where: { id: window.id },
    include: windowInclude,
  });

  return NextResponse.json(enrichWindow(refreshed), { status: 201 });
}
