import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canGenerateFeeStatements, FEE_OPERATOR_ROLES } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(FEE_OPERATOR_ROLES);
  if (auth.error) return auth.error;
  if (!canGenerateFeeStatements(auth.user.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  const statement = await prisma.feeStatement.findUnique({
    where: { id },
    select: {
      id: true,
      statementNo: true,
      status: true,
      paymentSettlement: true,
      studentNameSnapshot: true,
      generatedAt: true,
      issuedAt: true,
    },
  });
  if (!statement) return jsonError("Fee statement not found", 404);

  const events = await prisma.feeStatementEvent.findMany({
    where: { feeStatementId: id },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    statement,
    events: events.map((event) => ({
      id: event.id,
      kind: event.kind,
      occurredAt: event.occurredAt.toISOString(),
      summary: event.summary,
      paymentOrderId: event.paymentOrderId,
      actorName: event.actor?.name ?? null,
    })),
  });
}
