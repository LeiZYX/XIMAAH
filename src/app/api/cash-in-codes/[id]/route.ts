import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { deleteCashInCode, updateCashInCode } from "@/lib/cash-in-codes/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const data = parseJsonBody<{
    cashInCode?: string;
    active?: boolean;
    notes?: string | null;
  }>(body, []);

  try {
    const row = await updateCashInCode(id, {
      cashInCode: data?.cashInCode,
      active: data?.active,
      notes: data?.notes,
    });
    return NextResponse.json(row);
  } catch (error) {
    console.error("PATCH /api/cash-in-codes/[id] failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update cash-in code";
    return jsonError(message, 400);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  try {
    await deleteCashInCode(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/cash-in-codes/[id] failed:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to delete cash-in code", 400);
  }
}
