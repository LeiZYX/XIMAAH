import type { PaymentChannel, PaymentOrder, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createQrCodePaymentOrder,
  GlobePayError,
  queryGlobePayOrderStatus,
  revokeGlobePayOrder,
} from "@/lib/payments/globepay/client";
import { statementAmountDueGbp } from "@/lib/fees/payment-due";
import { recordFeeStatementEvent, recordFeeStatementEvents } from "@/lib/fees/statement-events";

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

const OPEN_PAYMENT_STATUSES = ["CREATED", "PAYING"] as const;

function channelCode(channel: PaymentChannel): string {
  return channel === "Wechat" ? "WX" : "ALI";
}

function sanitizeStatementNo(statementNo: string): string {
  return statementNo.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "STMT";
}

export function buildPartnerOrderId(params: {
  statementNo: string;
  channel: PaymentChannel;
  version: number;
}): string {
  return `PAY-${sanitizeStatementNo(params.statementNo)}-${channelCode(params.channel)}-v${params.version}`;
}

export function gbpToMinorUnits(amountGbp: Prisma.Decimal | number | string): number {
  const value = typeof amountGbp === "number" ? amountGbp : Number(amountGbp);
  if (!Number.isFinite(value) || value <= 0) {
    throw new PaymentError("Fee statement amount must be greater than zero");
  }
  const minor = Math.round(value * 100);
  if (minor < 1) {
    throw new PaymentError("Fee statement amount must be at least £0.01");
  }
  return minor;
}

export function serializePaymentOrder(
  order: PaymentOrder & {
    cancelledBy?: { id: string; name: string } | null;
  },
) {
  return {
    id: order.id,
    feeStatementId: order.feeStatementId,
    partnerOrderId: order.partnerOrderId,
    channel: order.channel,
    currency: order.currency,
    amountGbp: order.amountGbp.toFixed(2),
    amountMinor: order.amountMinor,
    status: order.status,
    description: order.description,
    codeUrl: order.codeUrl,
    qrcodeImg: order.qrcodeImg,
    payUrl: order.payUrl,
    globepayOrderId: order.globepayOrderId,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
    cancelledByUserId: order.cancelledByUserId,
    cancelledBy: order.cancelledBy ?? null,
    cancelNote: order.cancelNote,
    version: order.version,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

async function nextPaymentVersion(feeStatementId: string): Promise<number> {
  const latest = await prisma.paymentOrder.findFirst({
    where: { feeStatementId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

export async function closeOpenPaymentOrdersForStatements(
  statementIds: string[],
  reason?: string,
) {
  if (statementIds.length === 0) return { count: 0 };
  const open = await prisma.paymentOrder.findMany({
    where: {
      feeStatementId: { in: statementIds },
      status: { in: [...OPEN_PAYMENT_STATUSES] },
    },
    select: {
      id: true,
      feeStatementId: true,
      partnerOrderId: true,
      channel: true,
    },
  });
  if (open.length === 0) return { count: 0 };
  await prisma.paymentOrder.updateMany({
    where: { id: { in: open.map((order) => order.id) } },
    data: { status: "CLOSED" },
  });
  await recordFeeStatementEvents(
    prisma,
    open.map((order) => ({
      feeStatementId: order.feeStatementId,
      paymentOrderId: order.id,
      kind: "ORDER_CLOSED" as const,
      summary: `Closed ${order.channel} order ${order.partnerOrderId}${
        reason ? ` (${reason})` : ""
      }`,
    })),
  ).catch((error) => {
    console.error("Fee statement event log failed:", error);
  });
  return { count: open.length };
}

async function assertCanAccessFeeStatement(params: {
  feeStatementId: string;
  userId: string;
  role: string;
}) {
  const statement = await prisma.feeStatement.findUnique({
    where: { id: params.feeStatementId },
    include: {
      candidate: { select: { userId: true } },
    },
  });

  if (!statement) {
    throw new PaymentError("Fee statement not found", 404);
  }

  if (params.role === "STUDENT") {
    const ownsStatement =
      statement.studentId === params.userId || statement.candidate?.userId === params.userId;
    if (!ownsStatement || !statement.studentVisible) {
      throw new PaymentError("Forbidden", 403);
    }
  } else if (params.role !== "ADMIN" && params.role !== "EXAM_OFFICER") {
    throw new PaymentError("Forbidden", 403);
  }

  return statement;
}

export async function listPaymentOrdersForStatement(params: {
  feeStatementId: string;
  userId: string;
  role: string;
}) {
  await assertCanAccessFeeStatement(params);
  const orders = await prisma.paymentOrder.findMany({
    where: { feeStatementId: params.feeStatementId },
    include: { cancelledBy: { select: { id: true, name: true } } },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  });
  return orders.map(serializePaymentOrder);
}

export async function createOrReusePaymentOrder(params: {
  feeStatementId: string;
  channel: PaymentChannel;
  userId: string;
  role: string;
}) {
  const statement = await assertCanAccessFeeStatement(params);

  if (statement.status === "PAID") {
    throw new PaymentError("Fee statement is already paid");
  }
  if (statement.status !== "ISSUED") {
    throw new PaymentError("Only issued fee statements can be paid online");
  }

  const amountGbpNumber = statementAmountDueGbp(statement);
  if (amountGbpNumber <= 0) {
    throw new PaymentError("No additional payment is due on this fee statement");
  }
  const amountMinor = gbpToMinorUnits(amountGbpNumber);
  const amountGbp = amountGbpNumber;
  const previouslyPaidGbp = Number(statement.previouslyPaidGbpAmount ?? 0);
  const isBalanceDue = previouslyPaidGbp > 0;

  const openSameChannel = await prisma.paymentOrder.findFirst({
    where: {
      feeStatementId: statement.id,
      channel: params.channel,
      status: { in: [...OPEN_PAYMENT_STATUSES] },
    },
    orderBy: { version: "desc" },
  });

  if (openSameChannel) {
    if (
      openSameChannel.amountMinor === amountMinor &&
      (openSameChannel.codeUrl || openSameChannel.qrcodeImg)
    ) {
      return serializePaymentOrder(openSameChannel);
    }
    await prisma.paymentOrder.update({
      where: { id: openSameChannel.id },
      data: { status: "CLOSED" },
    });
    await recordFeeStatementEvent(prisma, {
      feeStatementId: statement.id,
      paymentOrderId: openSameChannel.id,
      kind: "ORDER_CLOSED",
      summary: `Closed ${openSameChannel.channel} order ${openSameChannel.partnerOrderId} before creating a new one`,
    }).catch((error) => {
      console.error("Fee statement event log failed:", error);
    });
  }

  const version = await nextPaymentVersion(statement.id);
  const partnerOrderId = buildPartnerOrderId({
    statementNo: statement.statementNo,
    channel: params.channel,
    version,
  });
  const description = (
    isBalanceDue
      ? `Exam fees ${statement.statementNo} balance £${amountGbpNumber.toFixed(2)} — ${statement.studentNoSnapshot}`
      : `Exam fees ${statement.statementNo} — ${statement.studentNoSnapshot}`
  ).slice(0, 128);

  let globepay;
  try {
    globepay = await createQrCodePaymentOrder({
      partnerOrderId,
      description,
      price: amountMinor,
      currency: "GBP",
      channel: params.channel,
    });
  } catch (error) {
    if (error instanceof GlobePayError) {
      throw new PaymentError(error.message, 502);
    }
    throw error;
  }

  const qrcodeImg = globepay.qrcode_img
    ? globepay.qrcode_img.startsWith("data:")
      ? globepay.qrcode_img
      : `data:image/png;base64,${globepay.qrcode_img}`
    : null;

  const order = await prisma.paymentOrder.create({
    data: {
      feeStatementId: statement.id,
      partnerOrderId,
      channel: params.channel,
      currency: "GBP",
      amountMinor,
      amountGbp,
      status: "CREATED",
      description,
      codeUrl: globepay.code_url ?? null,
      qrcodeImg,
      payUrl: globepay.pay_url ?? null,
      globepayOrderId: globepay.order_id ?? null,
      version,
    },
  });

  await recordFeeStatementEvent(prisma, {
    feeStatementId: statement.id,
    paymentOrderId: order.id,
    kind: "ORDER_CREATED",
    actorUserId: params.userId,
    summary: `Created ${params.channel} order ${partnerOrderId} for £${amountGbpNumber.toFixed(2)}`,
  }).catch((error) => {
    console.error("Fee statement event log failed:", error);
  });

  return serializePaymentOrder(order);
}

export async function markPaymentOrderPaid(params: {
  partnerOrderId: string;
  globepayOrderId?: string | null;
  notifyPayload?: Prisma.InputJsonValue;
  payTime?: string | null;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.paymentOrder.findUnique({
      where: { partnerOrderId: params.partnerOrderId },
      include: { feeStatement: true },
    });

    if (!order) {
      throw new PaymentError("Payment order not found", 404);
    }

    if (order.status === "PAID" && order.feeStatement.status === "PAID") {
      return { order, alreadyPaid: true as const, feeStatementId: order.feeStatementId };
    }

    if (order.status === "CLOSED" || order.status === "CANCELLED") {
      throw new PaymentError("Payment order is closed and can no longer be paid");
    }

    const paidAt = params.payTime ? new Date(params.payTime) : new Date();
    const safePaidAt = Number.isNaN(paidAt.getTime()) ? new Date() : paidAt;

    const updatedOrder = await tx.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: safePaidAt,
        globepayOrderId: params.globepayOrderId ?? order.globepayOrderId,
        notifyPayload: params.notifyPayload,
      },
    });

    const siblings = await tx.paymentOrder.findMany({
      where: {
        feeStatementId: order.feeStatementId,
        id: { not: order.id },
        status: { in: [...OPEN_PAYMENT_STATUSES] },
      },
      select: { id: true, partnerOrderId: true, channel: true },
    });

    if (siblings.length > 0) {
      await tx.paymentOrder.updateMany({
        where: { id: { in: siblings.map((row) => row.id) } },
        data: { status: "CLOSED" },
      });
      await recordFeeStatementEvents(
        tx,
        siblings.map((row) => ({
          feeStatementId: order.feeStatementId,
          paymentOrderId: row.id,
          kind: "ORDER_CLOSED" as const,
          occurredAt: safePaidAt,
          summary: `Closed ${row.channel} order ${row.partnerOrderId} after another order was paid`,
        })),
      );
    }

    if (order.feeStatement.status === "ISSUED" || order.feeStatement.status === "PAID") {
      const globepayId = params.globepayOrderId ?? order.globepayOrderId ?? order.partnerOrderId;
      const note = `Paid via ${order.channel} / GlobePay ${globepayId}`;
      await tx.feeStatement.update({
        where: { id: order.feeStatementId },
        data: {
          status: "PAID",
          paymentSettlement: "ONLINE",
          paymentNotes: order.feeStatement.paymentNotes
            ? `${order.feeStatement.paymentNotes}\n${note}`
            : note,
        },
      });
      await recordFeeStatementEvent(tx, {
        feeStatementId: order.feeStatementId,
        paymentOrderId: order.id,
        kind: "PAID_ONLINE",
        occurredAt: safePaidAt,
        summary: `Paid via ${order.channel} / ${order.partnerOrderId}${
          params.globepayOrderId || order.globepayOrderId
            ? ` (GlobePay ${params.globepayOrderId ?? order.globepayOrderId})`
            : ""
        }`,
      });
    }

    return {
      order: updatedOrder,
      alreadyPaid: false as const,
      feeStatementId: order.feeStatementId,
    };
  });

  if (!result.alreadyPaid) {
    const { queueFeeStatementPaidNotification } = await import(
      "@/lib/notifications/fee-statement-paid"
    );
    queueFeeStatementPaidNotification(result.feeStatementId);
  }

  return result;
}

export async function syncPaymentOrderFromGlobePay(params: {
  paymentOrderId: string;
  userId: string;
  role: string;
}) {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: params.paymentOrderId },
    include: {
      feeStatement: {
        include: { candidate: { select: { userId: true } } },
      },
    },
  });

  if (!order) {
    throw new PaymentError("Payment order not found", 404);
  }

  await assertCanAccessFeeStatement({
    feeStatementId: order.feeStatementId,
    userId: params.userId,
    role: params.role,
  });

  if (order.status === "PAID") {
    return serializePaymentOrder(order);
  }
  if (order.status === "CLOSED") {
    throw new PaymentError("Payment order is closed");
  }

  let remote;
  try {
    remote = await queryGlobePayOrderStatus(order.partnerOrderId);
  } catch (error) {
    if (error instanceof GlobePayError) {
      throw new PaymentError(error.message, 502);
    }
    throw error;
  }

  const remoteCode = String(remote.result_code ?? "").toUpperCase();

  if (remoteCode === "PAY_SUCCESS") {
    const result = await markPaymentOrderPaid({
      partnerOrderId: order.partnerOrderId,
      globepayOrderId: remote.order_id,
      notifyPayload: remote as unknown as Prisma.InputJsonValue,
      payTime: remote.pay_time,
    });
    return serializePaymentOrder(result.order);
  }

  if (remoteCode === "PAYING") {
    const updated = await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: "PAYING" },
    });
    return serializePaymentOrder(updated);
  }

  if (remoteCode === "CLOSED" || remoteCode === "PAY_FAIL") {
    const updated = await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: remoteCode === "CLOSED" ? "CLOSED" : "FAILED" },
    });
    return serializePaymentOrder(updated);
  }

  return serializePaymentOrder(order);
}

export async function cancelPaymentOrder(params: {
  paymentOrderId: string;
  cancelledByUserId: string;
  note?: string;
}) {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: params.paymentOrderId },
    include: {
      feeStatement: {
        select: {
          id: true,
          statementNo: true,
          studentNameSnapshot: true,
          studentNoSnapshot: true,
          status: true,
        },
      },
      cancelledBy: { select: { id: true, name: true } },
    },
  });

  if (!order) {
    throw new PaymentError("Payment order not found", 404);
  }

  if (order.status === "PAID") {
    throw new PaymentError("Paid orders cannot be cancelled. Use refund if needed.");
  }
  if (order.status === "CANCELLED") {
    return serializePaymentOrder(order);
  }
  if (order.status === "CLOSED") {
    throw new PaymentError("This payment order is already closed");
  }

  if (order.status === "CREATED" || order.status === "PAYING") {
    try {
      await revokeGlobePayOrder(order.partnerOrderId);
    } catch (error) {
      if (error instanceof GlobePayError) {
        if (error.code !== "ORDER_NOT_EXIST") {
          console.error("GlobePay revoke failed during cancel:", error.message, error.details);
        }
      } else {
        throw error;
      }
    }
  }

  const updated = await prisma.paymentOrder.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledByUserId: params.cancelledByUserId,
      cancelNote: params.note?.trim() || null,
      codeUrl: null,
      qrcodeImg: null,
      payUrl: null,
    },
    include: { cancelledBy: { select: { id: true, name: true } } },
  });

  await recordFeeStatementEvent(prisma, {
    feeStatementId: order.feeStatementId,
    paymentOrderId: order.id,
    kind: "ORDER_CANCELLED",
    actorUserId: params.cancelledByUserId,
    summary: `Cancelled ${order.channel} order ${order.partnerOrderId}${
      params.note?.trim() ? `: ${params.note.trim()}` : ""
    }`,
  }).catch((error) => {
    console.error("Fee statement event log failed:", error);
  });

  return serializePaymentOrder(updated);
}
