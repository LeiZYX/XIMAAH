import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { resolveCashInFee } from "@/lib/fees/cash-in-fee";
import { toNumber } from "@/lib/fees/money";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const examBoardId = request.nextUrl.searchParams.get("examBoardId");
  const examSeriesId = request.nextUrl.searchParams.get("examSeriesId");
  const qualificationId = request.nextUrl.searchParams.get("qualificationId");
  const subjectId = request.nextUrl.searchParams.get("subjectId");

  if (!examBoardId || !examSeriesId) {
    return jsonError("examBoardId and examSeriesId are required", 400);
  }

  try {
    const result = await resolveCashInFee({
      examBoardId,
      examSeriesId,
      qualificationId,
      subjectId,
    });

    if (!result) {
      return NextResponse.json({ found: false, schedule: null, matchLevel: null });
    }

    return NextResponse.json({
      found: true,
      matchLevel: result.matchLevel,
      schedule: {
        id: result.schedule.id,
        version: result.schedule.version,
        examBoardId: result.schedule.examBoardId,
        examSeriesId: result.schedule.examSeriesId,
        qualificationId: result.schedule.qualificationId,
        subjectId: result.schedule.subjectId,
        costCurrency: result.schedule.costCurrency,
        costAmount: toNumber(result.schedule.costAmount),
        salesCurrency: result.schedule.salesCurrency,
        salesAmount: toNumber(result.schedule.salesAmount),
        effectiveFrom: result.schedule.effectiveFrom.toISOString(),
        effectiveTo: result.schedule.effectiveTo?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("GET /api/fees/cash-in-quote failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to resolve cash-in fee",
      500,
    );
  }
}
