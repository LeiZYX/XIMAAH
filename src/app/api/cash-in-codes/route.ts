import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { createCashInCode, listCashInCodes } from "@/lib/cash-in-codes/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const examBoardId = request.nextUrl.searchParams.get("examBoardId") ?? undefined;
  const activeParam = request.nextUrl.searchParams.get("active");
  const active =
    activeParam === null ? undefined : activeParam === "true" ? true : activeParam === "false" ? false : undefined;

  try {
    const rows = await listCashInCodes({ examBoardId, active });
    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/cash-in-codes failed:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to list cash-in codes", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const data = parseJsonBody<{
    examBoardId?: string;
    subjectId?: string;
    cashInCode?: string;
    active?: boolean;
    notes?: string | null;
  }>(body, ["examBoardId", "subjectId", "cashInCode"]);

  if (!data?.examBoardId || !data.subjectId || !data.cashInCode) {
    return jsonError("examBoardId, subjectId, and cashInCode are required", 400);
  }

  try {
    const row = await createCashInCode({
      examBoardId: data.examBoardId,
      subjectId: data.subjectId,
      cashInCode: data.cashInCode,
      active: data.active,
      notes: data.notes,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("POST /api/cash-in-codes failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create cash-in code";
    const status = message.includes("Unique constraint") || message.includes("already") ? 409 : 400;
    return jsonError(message, status);
  }
}
