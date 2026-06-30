import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import type { FeeScheduleServiceType } from "@/generated/prisma";
import { createFeeScheduleVersion } from "@/lib/fees/fee-schedule";
import { prisma } from "@/lib/prisma";
import { logPostResultsAudit } from "@/lib/post-results/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const examBoardId = searchParams.get("examBoardId");
  const serviceType = searchParams.get("serviceType") as FeeScheduleServiceType | null;

  const where: Record<string, unknown> = {};
  if (examBoardId) where.examBoardId = examBoardId;
  if (serviceType) where.serviceType = serviceType;

  const schedules = await prisma.feeSchedule.findMany({
    where,
    include: {
      examBoard: { select: { id: true, name: true, code: true } },
      qualification: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      paper: { select: { id: true, code: true, title: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [
      { examBoardId: "asc" },
      { serviceType: "asc" },
      { version: "desc" },
    ],
  });

  return NextResponse.json(schedules);
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
    serviceType: FeeScheduleServiceType;
    qualificationId?: string | null;
    subjectId?: string | null;
    paperId?: string | null;
    entryType?: string | null;
    reviewType?: string | null;
    effectiveFrom: string;
    effectiveTo?: string | null;
    costCurrency: "GBP" | "CNY";
    costAmount: number;
    salesCurrency: "GBP" | "CNY";
    salesAmount: number;
    markupType?: "PERCENTAGE" | "FIXED_AMOUNT" | null;
    markupValue?: number | null;
    exchangeRateToCny?: number | null;
  }>(body, [
    "examBoardId",
    "serviceType",
    "effectiveFrom",
    "costCurrency",
    "costAmount",
    "salesCurrency",
    "salesAmount",
  ]);

  if (!data) return jsonError("Missing required fields");

  const board = await prisma.examBoard.findUnique({ where: { id: data.examBoardId } });
  if (!board) return jsonError("Exam board not found", 404);

  try {
    const schedule = await createFeeScheduleVersion({
      examBoardId: data.examBoardId,
      serviceType: data.serviceType,
      qualificationId: data.qualificationId,
      subjectId: data.subjectId,
      paperId: data.paperId,
      entryType: data.entryType as "NORMAL" | "LATE" | "HIGH_LATE" | null | undefined,
      reviewType: data.reviewType,
      effectiveFrom: new Date(data.effectiveFrom),
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      costCurrency: data.costCurrency,
      costAmount: data.costAmount,
      salesCurrency: data.salesCurrency,
      salesAmount: data.salesAmount,
      markupType: data.markupType,
      markupValue: data.markupValue,
      exchangeRateToCny: data.exchangeRateToCny,
      createdByUserId: auth.user.id,
    });

    await logPostResultsAudit({
      action: "FEE_SCHEDULE_VERSION_CREATED",
      performedByUserId: auth.user.id,
      examBoardId: data.examBoardId,
      serviceType: data.serviceType,
      metadata: { feeScheduleId: schedule.id, version: schedule.version },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("POST /api/fee-schedules failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create fee schedule version";
    if (message.includes("does not exist") || message.includes("FeeSchedule")) {
      return jsonError(
        "Fee schedule tables are not ready. Run: npx prisma migrate deploy",
        503,
      );
    }
    return jsonError(message, 500);
  }
}
