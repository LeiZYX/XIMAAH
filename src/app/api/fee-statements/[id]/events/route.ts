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
      registrationWorkspaceId: true,
    },
  });
  if (!statement) return jsonError("Fee statement not found", 404);

  const ownEvents = await prisma.feeStatementEvent.findMany({
    where: { feeStatementId: id },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
  });

  const workspaceId = statement.registrationWorkspaceId;
  const workspaceRemovalEvents = workspaceId
    ? await prisma.feeStatementEvent.findMany({
        where: {
          kind: "SUBJECT_REMOVED",
          feeStatement: { registrationWorkspaceId: workspaceId },
        },
        include: { actor: { select: { id: true, name: true } } },
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
      })
    : [];

  type HistoryRow = {
    id: string;
    kind: string;
    occurredAt: Date;
    createdAt: Date;
    summary: string;
    paymentOrderId: string | null;
    actorName: string | null;
  };

  const events: HistoryRow[] = ownEvents.map((event) => ({
    id: event.id,
    kind: event.kind,
    occurredAt: event.occurredAt,
    createdAt: event.createdAt,
    summary: event.summary,
    paymentOrderId: event.paymentOrderId,
    actorName: event.actor?.name ?? null,
  }));

  const summaries = new Set(
    events.filter((event) => event.kind === "SUBJECT_REMOVED").map((event) => event.summary),
  );
  for (const event of workspaceRemovalEvents) {
    if (summaries.has(event.summary)) continue;
    summaries.add(event.summary);
    events.push({
      id: event.id,
      kind: event.kind,
      occurredAt: event.occurredAt,
      createdAt: event.createdAt,
      summary: event.summary,
      paymentOrderId: event.paymentOrderId,
      actorName: event.actor?.name ?? null,
    });
  }

  // Older removals may only exist on OfflineWithdrawalRefund (before SUBJECT_REMOVED events).
  if (workspaceId) {
    const removalRows = await prisma.offlineWithdrawalRefund.findMany({
      where: {
        registrationWorkspaceId: workspaceId,
        creditGbp: { gt: 0 },
        status: { in: ["PENDING_OFFLINE", "NO_CASH_UNCOLLECTED", "COMPLETED"] },
      },
      include: { createdByUser: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    for (const row of removalRows) {
      const credit = Number(row.creditGbp);
      const summary =
        row.status === "NO_CASH_UNCOLLECTED"
          ? `Removed ${row.paperCodeSnapshot} (${row.subjectSnapshot}) · £${credit.toFixed(2)} · ${row.feeStageCode} ${Number(row.effectiveRefundPercent)}% · nothing collected — no cash refund`
          : `Removed ${row.paperCodeSnapshot} (${row.subjectSnapshot}) · cash refund due £${credit.toFixed(2)} · ${row.feeStageCode} ${Number(row.effectiveRefundPercent)}%`;
      if (summaries.has(summary)) continue;
      // Also skip if an existing event already mentions this paper code as removed.
      if (
        [...summaries].some(
          (text) => text.includes(`Removed ${row.paperCodeSnapshot}`) && text.includes("£"),
        )
      ) {
        continue;
      }
      summaries.add(summary);
      events.push({
        id: `removal-${row.id}`,
        kind: "SUBJECT_REMOVED",
        occurredAt: row.createdAt,
        createdAt: row.createdAt,
        summary,
        paymentOrderId: null,
        actorName: row.createdByUser?.name ?? null,
      });
    }
  }

  events.sort(
    (a, b) =>
      a.occurredAt.getTime() - b.occurredAt.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );

  return NextResponse.json({
    statement,
    events: events.map((event) => ({
      id: event.id,
      kind: event.kind,
      occurredAt: event.occurredAt.toISOString(),
      summary: event.summary,
      paymentOrderId: event.paymentOrderId,
      actorName: event.actorName,
    })),
  });
}
