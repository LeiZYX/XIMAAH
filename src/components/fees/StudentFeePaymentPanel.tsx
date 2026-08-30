"use client";

import { useCallback, useEffect, useState } from "react";
import { readJsonResponse } from "@/lib/client/fetch-json";
import { formatMoney } from "@/lib/fees/money";
import {
  paymentOrderStatusClass,
  paymentOrderStatusLabel,
} from "@/lib/payments/payment-status";

type PaymentChannel = "Wechat" | "Alipay";

export interface StudentPaymentOrder {
  id: string;
  partnerOrderId: string;
  channel: string;
  amountGbp: string | number;
  status: string;
  qrcodeImg?: string | null;
  codeUrl?: string | null;
  payUrl?: string | null;
  paidAt?: string | null;
  version: number;
}

interface StudentFeePaymentPanelProps {
  feeStatementId: string;
  statementStatus: string;
  totalGbpAmount: number | string;
  amountDueGbpAmount?: number | string | null;
  previouslyPaidGbpAmount?: number | string | null;
  existingOrders?: StudentPaymentOrder[];
  onPaid?: () => void;
}

function toAmount(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function StudentFeePaymentPanel({
  feeStatementId,
  statementStatus,
  totalGbpAmount,
  amountDueGbpAmount,
  previouslyPaidGbpAmount,
  existingOrders = [],
  onPaid,
}: StudentFeePaymentPanelProps) {
  const dueGbp =
    amountDueGbpAmount !== undefined && amountDueGbpAmount !== null
      ? toAmount(amountDueGbpAmount)
      : toAmount(totalGbpAmount);
  const paidAlready = toAmount(previouslyPaidGbpAmount ?? 0);
  const [orders, setOrders] = useState<StudentPaymentOrder[]>(existingOrders);
  const [activeOrder, setActiveOrder] = useState<StudentPaymentOrder | null>(null);
  const [loadingChannel, setLoadingChannel] = useState<PaymentChannel | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setOrders(existingOrders);
    const open =
      existingOrders.find((o) => o.status === "CREATED" || o.status === "PAYING") ?? null;
    const paid = existingOrders.find((o) => o.status === "PAID") ?? null;
    setActiveOrder(paid ?? open);
  }, [existingOrders]);

  const refreshOrders = useCallback(async () => {
    const response = await fetch(
      `/api/payments/orders?feeStatementId=${encodeURIComponent(feeStatementId)}`,
    );
    const data = await readJsonResponse<{ orders?: StudentPaymentOrder[]; error?: string }>(
      response,
    );
    if (!response.ok) {
      throw new Error(data.error ?? "Could not load payment orders");
    }
    const next = data.orders ?? [];
    setOrders(next);
    const paid = next.find((o) => o.status === "PAID");
    const open = next.find((o) => o.status === "CREATED" || o.status === "PAYING");
    setActiveOrder(paid ?? open ?? null);
    if (paid || statementStatus === "PAID") {
      onPaid?.();
    }
    return next;
  }, [feeStatementId, onPaid, statementStatus]);

  const syncActiveOrder = useCallback(async (orderId: string, options?: { quiet?: boolean }) => {
    if (!options?.quiet) {
      setSyncing(true);
      setError(null);
    }
    try {
      const response = await fetch(`/api/payments/orders/${orderId}/sync`, {
        method: "POST",
      });
      const data = await readJsonResponse<{ order?: StudentPaymentOrder; error?: string }>(
        response,
      );
      if (!response.ok || !data.order) {
        throw new Error(data.error ?? "Could not sync payment status");
      }
      setActiveOrder(data.order);
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === data.order!.id);
        return exists
          ? prev.map((o) => (o.id === data.order!.id ? data.order! : o))
          : [data.order!, ...prev];
      });
      if (data.order.status === "PAID") {
        setMessage("Payment received. Thank you.");
        onPaid?.();
      } else if (!options?.quiet) {
        setMessage(`Current status: ${paymentOrderStatusLabel(data.order.status)}`);
      }
      return data.order;
    } catch (err) {
      if (!options?.quiet) {
        setError(err instanceof Error ? err.message : "Could not sync payment status");
      }
      return null;
    } finally {
      if (!options?.quiet) setSyncing(false);
    }
  }, [onPaid]);

  // While waiting for payment, poll GlobePay so the UI flips to Paid without a manual Refresh
  // (webhook notify may be delayed or unreachable).
  useEffect(() => {
    const orderId = activeOrder?.id;
    const awaiting =
      activeOrder?.status === "CREATED" || activeOrder?.status === "PAYING";
    if (!orderId || !awaiting) return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      void syncActiveOrder(orderId, { quiet: true });
    };
    const intervalId = window.setInterval(tick, 4000);
    const timeoutId = window.setTimeout(tick, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [activeOrder?.id, activeOrder?.status, syncActiveOrder]);

  async function startPayment(channel: PaymentChannel) {
    setLoadingChannel(channel);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/payments/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeStatementId, channel }),
      });
      const data = await readJsonResponse<{ order?: StudentPaymentOrder; error?: string }>(
        response,
      );
      if (!response.ok || !data.order) {
        throw new Error(data.error ?? "Could not create payment order");
      }
      setActiveOrder(data.order);
      setOrders((prev) => {
        const others = prev.filter((o) => o.id !== data.order!.id);
        return [data.order!, ...others];
      });
      setMessage(
        `Scan the ${channel} QR code to pay ${formatMoney(dueGbp, "GBP")}${paidAlready > 0 ? " (balance)" : ""}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create payment order");
    } finally {
      setLoadingChannel(null);
    }
  }

  async function checkPaymentStatus() {
    if (!activeOrder?.id) {
      try {
        await refreshOrders();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not refresh payment status");
      }
      return;
    }
    await syncActiveOrder(activeOrder.id);
  }

  if (statementStatus === "PAID" || activeOrder?.status === "PAID") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
        <p className="font-medium">Paid</p>
        <p className="mt-1 text-emerald-800">
          {formatMoney(
            toAmount(activeOrder?.amountGbp ?? (dueGbp > 0 ? dueGbp : totalGbpAmount)),
            "GBP",
          )}
          {activeOrder?.channel ? ` via ${activeOrder.channel}` : ""}
          {activeOrder?.paidAt
            ? ` · ${new Date(activeOrder.paidAt).toLocaleString()}`
            : ""}
        </p>
      </div>
    );
  }

  if (statementStatus !== "ISSUED") {
    return null;
  }

  if (dueGbp <= 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
        <p className="font-medium">No additional payment due</p>
        <p className="mt-1 text-emerald-800">
          Full fee total {formatMoney(toAmount(totalGbpAmount), "GBP")}
          {paidAlready > 0 ? ` · already paid ${formatMoney(paidAlready, "GBP")}` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div>
        <p className="text-sm font-medium text-slate-900">
          {paidAlready > 0 ? "Pay balance online (GBP)" : "Pay online (GBP)"}
        </p>
        <p className="mt-0.5 text-xs text-slate-600">
          {paidAlready > 0 ? (
            <>
              Full total {formatMoney(toAmount(totalGbpAmount), "GBP")} · already paid{" "}
              {formatMoney(paidAlready, "GBP")} · <strong>due {formatMoney(dueGbp, "GBP")}</strong>
            </>
          ) : (
            <>Amount due: {formatMoney(dueGbp, "GBP")}.</>
          )}{" "}
          Choose WeChat or Alipay, then scan the QR code. Status updates automatically after payment
          (or tap Refresh).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loadingChannel !== null}
          onClick={() => void startPayment("Wechat")}
          className="rounded-lg bg-[#07C160] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loadingChannel === "Wechat" ? "Creating…" : "Pay with WeChat"}
        </button>
        <button
          type="button"
          disabled={loadingChannel !== null}
          onClick={() => void startPayment("Alipay")}
          className="rounded-lg bg-[#1677FF] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loadingChannel === "Alipay" ? "Creating…" : "Pay with Alipay"}
        </button>
        <button
          type="button"
          disabled={syncing || loadingChannel !== null}
          onClick={() => void checkPaymentStatus()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {syncing ? "Checking…" : "Refresh"}
        </button>
      </div>

      {message ? <p className="text-xs text-slate-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}

      {activeOrder && (activeOrder.status === "CREATED" || activeOrder.status === "PAYING") ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-slate-900">{activeOrder.channel}</span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 font-medium ${paymentOrderStatusClass(activeOrder.status)}`}
            >
              {paymentOrderStatusLabel(activeOrder.status)}
            </span>
            <span className="text-slate-500">
              {formatMoney(toAmount(activeOrder.amountGbp), "GBP")}
            </span>
          </div>
          <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
            {activeOrder.partnerOrderId}
          </p>
          {activeOrder.qrcodeImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeOrder.qrcodeImg}
              alt={`${activeOrder.channel} payment QR code`}
              className="mx-auto mt-3 h-52 w-52 rounded-md border border-slate-100 bg-white object-contain p-2"
            />
          ) : activeOrder.codeUrl ? (
            <p className="mt-3 break-all text-xs text-slate-600">
              QR content: {activeOrder.codeUrl}
            </p>
          ) : (
            <p className="mt-3 text-xs text-amber-800">
              Payment order created, but no QR image was returned. Contact the Exams Office.
            </p>
          )}
          {activeOrder.payUrl ? (
            <a
              href={activeOrder.payUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs font-medium text-indigo-700 hover:text-indigo-800"
            >
              Open GlobePay payment page
            </a>
          ) : null}
        </div>
      ) : null}

      {orders.some((o) => o.status === "CANCELLED") ? (
        <p className="text-xs text-slate-500">
          A previous payment order was cancelled. You can create a new WeChat or Alipay order above.
        </p>
      ) : null}
    </div>
  );
}
