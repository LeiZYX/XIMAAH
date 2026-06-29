import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canConfigureFeeRules } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string; ruleId: string }> };

const feeRuleInclude = {
  examBoard: { select: { id: true, name: true, code: true } },
  examSeries: { select: { id: true, name: true, year: true } },
  qualification: { select: { id: true, name: true, level: true } },
  subject: { select: { id: true, name: true, code: true } },
  paper: { select: { id: true, code: true, title: true } },
  examSession: { select: { id: true, date: true } },
} as const;

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canConfigureFeeRules(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id, ruleId } = await params;
  const body = await request.json();

  const existing = await prisma.feeRule.findFirst({
    where: { id: ruleId, registrationWindowId: id },
  });
  if (!existing) return jsonError("Fee rule not found", 404);

  const rule = await prisma.feeRule.update({
    where: { id: ruleId },
    data: {
      ...(body.subjectId !== undefined ? { subjectId: body.subjectId || null } : {}),
      ...(body.paperId !== undefined ? { paperId: body.paperId || null } : {}),
      ...(body.examSessionId !== undefined ? { examSessionId: body.examSessionId || null } : {}),
      ...(body.entryType ? { entryType: body.entryType } : {}),
      ...(body.costCurrency ? { costCurrency: body.costCurrency } : {}),
      ...(body.costAmount !== undefined ? { costAmount: body.costAmount } : {}),
      ...(body.exchangeRateToCny !== undefined
        ? { exchangeRateToCny: body.exchangeRateToCny || null }
        : {}),
      ...(body.markupType ? { markupType: body.markupType } : {}),
      ...(body.markupValue !== undefined ? { markupValue: body.markupValue ?? null } : {}),
      ...(body.salesCurrency ? { salesCurrency: body.salesCurrency } : {}),
      ...(body.salesAmount !== undefined ? { salesAmount: body.salesAmount ?? null } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    },
    include: feeRuleInclude,
  });

  return NextResponse.json(rule);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canConfigureFeeRules(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id, ruleId } = await params;

  const existing = await prisma.feeRule.findFirst({
    where: { id: ruleId, registrationWindowId: id },
  });
  if (!existing) return jsonError("Fee rule not found", 404);

  await prisma.feeRule.delete({ where: { id: ruleId } });
  return NextResponse.json({ ok: true });
}
