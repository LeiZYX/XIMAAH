import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageRegistrationWindows } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { cashInRequestInclude, updateCashInRequestStatus } from "@/lib/cash-in-requests/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const row = await prisma.cashInRequest.findUnique({
    where: { id },
    include: cashInRequestInclude,
  });
  if (!row) return jsonError("Cash-in request not found", 404);
  return NextResponse.json(row);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;
  if (!canManageRegistrationWindows(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const data = parseJsonBody<{
    status?: string;
    notes?: string | null;
    reason?: string | null;
  }>(body, []);

  if (!data) return jsonError("Invalid body", 400);

  try {
    if (data.status) {
      const updated = await updateCashInRequestStatus({
        id,
        status: data.status,
        performedByUserId: auth.user.id,
        notes: data.notes,
      });
      return NextResponse.json(updated);
    }

    const updated = await prisma.cashInRequest.update({
      where: { id },
      data: {
        notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
        reason: data.reason !== undefined ? data.reason?.trim() || null : undefined,
      },
      include: cashInRequestInclude,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/cash-in-requests/[id] failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to update cash-in request",
      400,
    );
  }
}
