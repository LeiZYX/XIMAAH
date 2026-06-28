import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canConfigureFeeRules } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canConfigureFeeRules(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id: targetWindowId } = await params;
  const body = await request.json();
  const data = parseJsonBody<{ sourceWindowId: string }>(body, ["sourceWindowId"]);
  if (!data) return jsonError("sourceWindowId is required");

  const sourceRules = await prisma.feeRule.findMany({
    where: { registrationWindowId: data.sourceWindowId },
  });

  if (sourceRules.length === 0) {
    return jsonError("No fee rules found in source registration window");
  }

  const targetWindow = await prisma.registrationWindow.findUnique({
    where: { id: targetWindowId },
  });
  if (!targetWindow) return jsonError("Target registration window not found", 404);

  await prisma.feeRule.deleteMany({ where: { registrationWindowId: targetWindowId } });

  const created = await prisma.$transaction(
    sourceRules.map((rule) =>
      prisma.feeRule.create({
        data: {
          registrationWindowId: targetWindowId,
          examBoardId: rule.examBoardId,
          examSeriesId: rule.examSeriesId,
          qualificationId: rule.qualificationId,
          subjectId: rule.subjectId,
          paperId: rule.paperId,
          examSessionId: rule.examSessionId,
          entryType: rule.entryType,
          costCurrency: rule.costCurrency,
          costAmount: rule.costAmount,
          exchangeRateToCny: rule.exchangeRateToCny,
          markupType: rule.markupType,
          markupValue: rule.markupValue,
          salesCurrency: rule.salesCurrency,
          salesAmount: rule.salesAmount,
          isActive: rule.isActive,
          createdByUserId: auth.user.id,
        },
      }),
    ),
  );

  const sourceRates = await prisma.exchangeRate.findMany({
    where: { registrationWindowId: data.sourceWindowId },
  });

  if (sourceRates.length > 0) {
    await prisma.exchangeRate.deleteMany({ where: { registrationWindowId: targetWindowId } });
    await prisma.$transaction(
      sourceRates.map((rate) =>
        prisma.exchangeRate.create({
          data: {
            registrationWindowId: targetWindowId,
            baseCurrency: rate.baseCurrency,
            targetCurrency: rate.targetCurrency,
            rate: rate.rate,
            effectiveDate: rate.effectiveDate,
            createdByUserId: auth.user.id,
          },
        }),
      ),
    );
  }

  return NextResponse.json({ copiedRules: created.length, copiedRates: sourceRates.length });
}
