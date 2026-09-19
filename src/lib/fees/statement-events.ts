import type { FeeStatementEventKind } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type FeeDb = Prisma.TransactionClient | typeof prisma;

export interface FeeStatementEventInput {
  feeStatementId: string;
  paymentOrderId?: string | null;
  kind: FeeStatementEventKind;
  occurredAt?: Date;
  actorUserId?: string | null;
  summary: string;
}

export async function recordFeeStatementEvents(db: FeeDb, inputs: FeeStatementEventInput[]) {
  if (inputs.length === 0) return;
  const occurredAt = new Date();
  await db.feeStatementEvent.createMany({
    data: inputs.map((input) => ({
      feeStatementId: input.feeStatementId,
      paymentOrderId: input.paymentOrderId ?? null,
      kind: input.kind,
      occurredAt: input.occurredAt ?? occurredAt,
      actorUserId: input.actorUserId ?? null,
      summary: input.summary,
    })),
  });
}

export async function recordFeeStatementEvent(db: FeeDb, input: FeeStatementEventInput) {
  await recordFeeStatementEvents(db, [input]);
}

/** Generated, and issued / covered / regenerated / repriced when those happen in the same save. */
export async function recordOpenedFeeStatement(params: {
  statementId: string;
  statementNo: string;
  actorUserId: string;
  issued: boolean;
  covered: boolean;
  regenerated?: boolean;
  repriced?: boolean;
}) {
  const events: FeeStatementEventInput[] = [
    {
      feeStatementId: params.statementId,
      kind: "GENERATED",
      actorUserId: params.actorUserId,
      summary: `Generated ${params.statementNo}`,
    },
  ];
  if (params.covered) {
    events.push({
      feeStatementId: params.statementId,
      kind: "COVERED",
      actorUserId: params.actorUserId,
      summary: `No balance due. ${params.statementNo} marked Paid · Covered`,
    });
  } else if (params.issued) {
    events.push({
      feeStatementId: params.statementId,
      kind: "ISSUED",
      actorUserId: params.actorUserId,
      summary: `Issued ${params.statementNo}`,
    });
  }
  if (params.regenerated) {
    events.push({
      feeStatementId: params.statementId,
      kind: "REGENERATED",
      actorUserId: params.actorUserId,
      summary: `Regenerated revised statement ${params.statementNo}`,
    });
  }
  if (params.repriced) {
    events.push({
      feeStatementId: params.statementId,
      kind: "REPRICED",
      actorUserId: params.actorUserId,
      summary: `Repriced ${params.statementNo} by current fee stage`,
    });
  }
  await recordFeeStatementEvents(prisma, events);
}
