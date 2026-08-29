"use client";

import { useState } from "react";
import { readJsonResponse } from "@/lib/client/fetch-json";
import {
  paymentOrderStatusClass,
  paymentOrderStatusLabel,
  summariseStatementPayments,
} from "@/lib/payments/payment-status";

export interface PaymentOrderRow {
  id: string;
  partnerOrderId: string;
  channel: "Wechat" | "Alipay" | string;
  currency: string;
  amountGbp: string | number;
  status: string;
  paidAt?: string | Date | null;
  cancelledAt?: string | Date | null;
  cancelledBy?: { id: string; name: string } | null;
  cancelNote?: string | null;
  version: number;
  createdAt: string | Date;
}

interface StatementPaymentOrdersPanelProps {
  orders: PaymentOrderRow[];
  onChanged?: () => void;
  /** Compact summary for table cells */
  compact?: boolean;
}

function amountLabel(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : String(value);
}

export function StatementPaymentSummary({ orders }: { orders: PaymentOrderRow[] }) {
  const summary = summariseStatementPayments(
    orders.map((o) => ({
      status: o.status,
      channel: o.channel,
      partnerOrderId: o.partnerOrderId,
      amountGbp: amountLabel(o.amountGbp),
    })),
  );

  const className =
    summary.tone === "paid"
      ? "bg-emerald-100 text-emerald-800"
      : summary.tone === "unpaid"
        ? "bg-amber-100 text-amber-900"
        : summary.tone === "cancelled"
          ? "bg-red-100 text-red-800"
          : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {summary.label}
    </span>
  );
}

export function StatementPaymentOrdersPanel({
  orders,
  onChanged,
  compact = false,
}: StatementPaymentOrdersPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);

  async function handleCancel(orderId: string) {
    const confirmed = window.confirm(
      "Cancel this payment order? The QR code will stop working. The fee statement stays Issued until a new payment succeeds.",
    );
    if (!confirmed) return;

    const noteInput = window.prompt("Optional cancel note:");
    if (noteInput === null) return;

    setBusyId(orderId);
    setError(null);
    try {
      const response = await fetch(`/api/payments/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteInput.trim() || undefined }),
      });
      const data = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Cancel failed");
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusyId(null);
    }
  }

  if (orders.length === 0) {
    return <p className="text-xs text-slate-500">No online payment orders yet.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatementPaymentSummary orders={orders} />
        {compact ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-indigo-700 hover:text-indigo-800"
          >
            {expanded ? "Hide orders" : "View orders"}
          </button>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-700">{error}</p> : null}

      {expanded ? (
        <ul className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2">
          {orders.map((order) => {
            const canCancel = order.status === "CREATED" || order.status === "PAYING";
            return (
              <li
                key={order.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-white px-2.5 py-2 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{order.channel}</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 font-medium ${paymentOrderStatusClass(order.status)}`}
                    >
                      {paymentOrderStatusLabel(order.status)}
                    </span>
                    <span className="text-slate-600">£{amountLabel(order.amountGbp)}</span>
                    <span className="text-slate-400">v{order.version}</span>
                  </div>
                  <p className="break-all font-mono text-[11px] text-slate-500">
                    {order.partnerOrderId}
                  </p>
                  {order.paidAt ? (
                    <p className="text-slate-500">
                      Paid {new Date(order.paidAt).toLocaleString()}
                    </p>
                  ) : null}
                  {order.cancelledAt ? (
                    <p className="text-slate-500">
                      Cancelled {new Date(order.cancelledAt).toLocaleString()}
                      {order.cancelledBy?.name ? ` · ${order.cancelledBy.name}` : ""}
                      {order.cancelNote ? ` · ${order.cancelNote}` : ""}
                    </p>
                  ) : null}
                </div>
                {canCancel ? (
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => void handleCancel(order.id)}
                    className="rounded border border-red-200 px-2 py-1 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {busyId === order.id ? "Cancelling…" : "Cancel"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
