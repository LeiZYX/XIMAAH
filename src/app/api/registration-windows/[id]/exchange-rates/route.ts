import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canConfigureFeeRules } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;

  const rates = await prisma.exchangeRate.findMany({
    where: { registrationWindowId: id },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(rates);
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
    baseCurrency: string;
    targetCurrency: string;
    rate: string | number;
    effectiveDate: string;
  }>(body, ["baseCurrency", "targetCurrency", "rate", "effectiveDate"]);

  if (!data) return jsonError("Missing required fields");

  const rate = await prisma.exchangeRate.create({
    data: {
      registrationWindowId,
      baseCurrency: data.baseCurrency as "GBP" | "CNY",
      targetCurrency: data.targetCurrency as "GBP" | "CNY",
      rate: data.rate,
      effectiveDate: new Date(data.effectiveDate),
      createdByUserId: auth.user.id,
    },
  });

  return NextResponse.json(rate, { status: 201 });
}
