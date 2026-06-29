import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canConfigureFeeRules } from "@/lib/auth/permissions";
import { bulkCreateCalendarSubjectFeeRules } from "@/lib/fees/fee-rules-spreadsheet";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canConfigureFeeRules(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id: registrationWindowId } = await params;
  const body = await request.json();
  const data = parseJsonBody<{
    entryType?: string;
    costCurrency?: string;
    costAmount: string | number;
    exchangeRateToCny?: string | number;
    markupType?: string;
    markupValue?: string | number;
    salesCurrency?: string;
    salesAmount?: string | number;
    isActive?: boolean;
  }>(body, ["costAmount"]);

  if (!data) return jsonError("costAmount is required");

  try {
    const result = await bulkCreateCalendarSubjectFeeRules(
      registrationWindowId,
      {
        entryType: (data.entryType?.toUpperCase() as "NORMAL" | "LATE" | "HIGH_LATE") ?? "NORMAL",
        costCurrency: (data.costCurrency?.toUpperCase() as "GBP" | "CNY") ?? "GBP",
        costAmount: data.costAmount,
        exchangeRateToCny: data.exchangeRateToCny,
        markupType:
          (data.markupType?.toUpperCase() as "PERCENTAGE" | "FIXED_AMOUNT" | "MANUAL") ??
          "PERCENTAGE",
        markupValue: data.markupValue,
        salesCurrency: (data.salesCurrency?.toUpperCase() as "GBP" | "CNY") ?? "GBP",
        salesAmount: data.salesAmount,
        isActive: data.isActive ?? true,
      },
      auth.user.id,
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Bulk create failed", 500);
  }
}
