import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { assertCieWindow, resolveSubjectForSyllabus } from "@/lib/cie/catalog";
import { normalizeComponentCode } from "@/lib/cie/option-match";
import { RegistrationError } from "@/lib/registrations/errors";
import { windowIncludesSeries } from "@/lib/registrations/included-series";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth([
    "STUDENT",
    "SUBJECT_TEACHER",
    "EXAM_OFFICER",
    "ADMIN",
  ]);
  if (auth.error) return auth.error;

  const registrationWindowId = request.nextUrl.searchParams.get("registrationWindowId");
  const syllabusCode = request.nextUrl.searchParams.get("syllabusCode")?.trim().toUpperCase();
  const subjectIdParam = request.nextUrl.searchParams.get("subjectId");

  if (!registrationWindowId || !syllabusCode) {
    return jsonError("registrationWindowId and syllabusCode are required");
  }

  try {
    const window = await assertCieWindow(registrationWindowId);
    const subject =
      (subjectIdParam
        ? await prisma.subject.findUnique({
            where: { id: subjectIdParam },
            include: { papers: { select: { id: true, code: true } } },
          })
        : null) ??
      (await resolveSubjectForSyllabus({
        examBoardId: window.examBoardId,
        syllabusCode,
        preferredSubjectId: subjectIdParam,
      }));

    if (!subject) {
      return NextResponse.json({ sessions: [] });
    }

    const includedSeriesIds = window.includedSeries.map((row) => row.examSeriesId);
    const seriesIds = [...new Set([window.examSeriesId, ...includedSeriesIds])];
    const sessions = await prisma.examSession.findMany({
      where: {
        examSeriesId: { in: seriesIds },
        paper: { subjectId: subject.id },
      },
      include: {
        paper: { select: { code: true, title: true, subjectId: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const visible = sessions.filter((session) =>
      windowIncludesSeries(
        {
          examBoardId: window.examBoardId,
          examSeriesId: window.examSeriesId,
          includedSeries: includedSeriesIds.map((examSeriesId) => ({
            examSeriesId,
            examSeries: { examBoardId: window.examBoardId },
          })),
        },
        session.examSeriesId,
        window.examBoardId,
      ),
    );

    return NextResponse.json({
      subjectId: subject.id,
      syllabusCode,
      sessions: visible.map((session) => ({
        id: session.id,
        paperCode: normalizeComponentCode(session.paper.code) || session.paper.code,
        paperTitle: session.paper.title,
        date: session.date.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
