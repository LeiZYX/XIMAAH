import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import { upsertCieOptionsForSeries, type CieOptionImportRow } from "@/lib/cie/catalog";
import { assertCieWindow, listCieOptionsForSeries } from "@/lib/cie/catalog";
import { RegistrationError } from "@/lib/registrations/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const examSeriesId = request.nextUrl.searchParams.get("examSeriesId");
  const registrationWindowId = request.nextUrl.searchParams.get("registrationWindowId");

  try {
    if (registrationWindowId) {
      const window = await assertCieWindow(registrationWindowId);
      const options = await listCieOptionsForSeries(window.examSeriesId, false);
      return NextResponse.json({ examSeriesId: window.examSeriesId, options });
    }
    if (!examSeriesId) return jsonError("examSeriesId or registrationWindowId is required");
    const options = await listCieOptionsForSeries(examSeriesId, false);
    return NextResponse.json({ examSeriesId, options });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
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
    examBoardId?: string;
    examSeriesId: string;
    rows: CieOptionImportRow[];
  }>(body, ["examSeriesId"]);

  if (!data || !Array.isArray(data.rows)) {
    return jsonError("examSeriesId and rows[] are required");
  }

  try {
    let examBoardId = data.examBoardId;
    if (!examBoardId) {
      const series = await prisma.examSeries.findUnique({
        where: { id: data.examSeriesId },
        select: { examBoardId: true },
      });
      if (!series) return jsonError("Exam series not found", 404);
      examBoardId = series.examBoardId;
    }

    const result = await upsertCieOptionsForSeries({
      examBoardId,
      examSeriesId: data.examSeriesId,
      rows: data.rows,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
