import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canConfigureFeeRules, canViewFeeRuleCosts } from "@/lib/auth/permissions";
import { getCalendarSubjectsForExamBoard } from "@/lib/calendar-subject-selections";
import { normalizeFeeRuleTemplateInput } from "@/lib/fees/fee-rules-spreadsheet";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

const feeRuleInclude = {
  examBoard: { select: { id: true, name: true, code: true } },
  examSeries: { select: { id: true, name: true, year: true } },
  qualification: { select: { id: true, name: true, level: true } },
  subject: { select: { id: true, name: true, code: true } },
  paper: { select: { id: true, code: true, title: true } },
  examSession: {
    select: {
      id: true,
      date: true,
      paper: { select: { code: true, title: true } },
    },
  },
} as const;

function sanitizeFeeRule<T extends Record<string, unknown>>(
  rule: T,
  showCosts: boolean,
): Record<string, unknown> {
  if (showCosts) return rule;
  const {
    costCurrency: _c,
    costAmount: _a,
    exchangeRateToCny: _e,
    markupType: _m,
    markupValue: _v,
    ...rest
  } = rule;
  return rest;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const showCosts = canViewFeeRuleCosts(auth.user.role);

  const rules = await prisma.feeRule.findMany({
    where: { registrationWindowId: id },
    include: feeRuleInclude,
    orderBy: [{ qualificationId: "asc" }, { subjectId: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(rules.map((rule) => sanitizeFeeRule(rule, showCosts)));
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canConfigureFeeRules(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id: registrationWindowId } = await params;
  const body = await request.json();
  const data = parseJsonBody<{
    examBoardId: string;
    examSeriesId: string;
    subjectId: string;
    entryType?: string;
    costCurrency: string;
    costAmount: string | number;
    exchangeRateToCny?: string | number;
    markupType: string;
    markupValue?: string | number;
    salesCurrency: string;
    salesAmount?: string | number;
    isActive?: boolean;
  }>(body, [
    "examBoardId",
    "examSeriesId",
    "subjectId",
    "costCurrency",
    "costAmount",
    "markupType",
    "salesCurrency",
  ]);

  if (!data) return jsonError("Missing required fields");

  const subject = await prisma.subject.findFirst({
    where: {
      id: data.subjectId,
      qualification: { examBoardId: data.examBoardId },
    },
    select: { id: true, qualificationId: true },
  });

  if (!subject) {
    return jsonError("Invalid calendar subject for this exam board", 400);
  }

  const calendarSubjects = await getCalendarSubjectsForExamBoard(data.examBoardId);
  if (!calendarSubjects.some((item) => item.id === subject.id)) {
    return jsonError(
      "Subject is not configured as a calendar subject for this exam board",
      400,
    );
  }

  const rule = await prisma.feeRule.create({
    data: {
      registrationWindowId,
      examBoardId: data.examBoardId,
      examSeriesId: data.examSeriesId,
      qualificationId: subject.qualificationId,
      subjectId: subject.id,
      paperId: null,
      examSessionId: null,
      createdByUserId: auth.user.id,
      ...normalizeFeeRuleTemplateInput({
        entryType: (data.entryType as "NORMAL" | "LATE" | "HIGH_LATE") ?? "NORMAL",
        costCurrency: data.costCurrency as "GBP" | "CNY",
        costAmount: data.costAmount,
        exchangeRateToCny: data.exchangeRateToCny,
        markupType: data.markupType as "PERCENTAGE" | "FIXED_AMOUNT" | "MANUAL",
        markupValue: data.markupValue,
        salesCurrency: data.salesCurrency as "GBP" | "CNY",
        salesAmount: data.salesAmount,
        isActive: data.isActive,
      }),
    },
    include: feeRuleInclude,
  });

  return NextResponse.json(rule, { status: 201 });
}
