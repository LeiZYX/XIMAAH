"use client";

import { useEffect, useMemo, useState } from "react";
import { readJsonResponse } from "@/lib/client/fetch-json";
import { formatMoney, roundMoney } from "@/lib/fees/money";
import { feeRefundStatusLabel } from "@/lib/fees/refund-labels";

type RefundOrder = {
  id: string;
  partnerOrderId: string;
  channel: string;
  statementNo: string;
  amountGbp: number;
  refundedGbp: number;
  remainingGbp: number;
};

type PendingLine = {
  id: string;
  paperCode: string;
  subject: string;
  creditGbp: number;
  allocatedGbp: number;
  remainingGbp: number;
};

type RefundContext = {
  statementNo: string;
  collectedGbp: number;
  alreadyRefundedGbp: number;
  refundableGbp: number;
  refundDueGbp: number;
  refundStatus: string;
  orders: RefundOrder[];
  pendingLines: PendingLine[];
};

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function channelLabel(channel: string) {
  if (channel === "Wechat") return "WeChat";
  if (channel === "Alipay") return "Alipay";
  return channel;
}

function allocateChecked(
  lines: PendingLine[],
  checked: Set<string>,
  amountGbp: number,
) {
  let left = roundMoney(amountGbp);
  const allocations: Array<{ offlineWithdrawalRefundId: string; amountGbp: number }> = [];
  for (const line of lines) {
    if (!checked.has(line.id) || left <= 0) continue;
    const take = roundMoney(Math.min(left, line.remainingGbp));
    if (take <= 0) continue;
    allocations.push({ offlineWithdrawalRefundId: line.id, amountGbp: take });
    left = roundMoney(left - take);
  }
  return { allocations, leftover: left };
}

export function FeeRefundModal({
  statementId,
  statementNo,
  initialLineIds,
  onClose,
  onSaved,
}: {
  statementId: string;
  statementNo?: string;
  initialLineIds?: string[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [context, setContext] = useState<RefundContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [method, setMethod] = useState<"ORIGINAL_CHANNEL" | "OFFLINE">("OFFLINE");
  const [paymentOrderId, setPaymentOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [refundedAt, setRefundedAt] = useState(todayInputValue);
  const [externalReference, setExternalReference] = useState("");
  const [reason, setReason] = useState<"WITHDRAWAL" | "OVERPAYMENT" | "OTHER">("OVERPAYMENT");
  const [note, setNote] = useState("");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  const initialKey = (initialLineIds ?? []).join(",");

  useEffect(() => {
    let cancelled = false;
    const preferred = new Set(initialKey ? initialKey.split(",") : []);
    void (async () => {
      try {
        const response = await fetch(`/api/fee-statements/${statementId}/refund-context`);
        const body = await readJsonResponse<RefundContext & { error?: string }>(response);
        if (!response.ok) throw new Error(body.error ?? "Could not load refund details");
        if (cancelled) return;
        setContext(body);
        const refundableOrders = body.orders.filter((order) => order.remainingGbp > 0.004);
        const pending = body.pendingLines;
        const checked = pending
          .filter((line) => (preferred.size > 0 ? preferred.has(line.id) : true))
          .map((line) => line.id);
        setCheckedIds(checked);
        const checkedRemaining = roundMoney(
          pending
            .filter((line) => checked.includes(line.id))
            .reduce((sum, line) => sum + line.remainingGbp, 0),
        );
        if (pending.length > 0 && checkedRemaining > 0) {
          setReason("WITHDRAWAL");
          setAmount(Math.min(checkedRemaining, body.refundableGbp).toFixed(2));
        } else {
          setReason("OVERPAYMENT");
          setAmount(body.refundableGbp > 0 ? body.refundableGbp.toFixed(2) : "");
        }
        if (refundableOrders.length > 0) {
          setMethod("ORIGINAL_CHANNEL");
          setPaymentOrderId(refundableOrders[0].id);
        } else {
          setMethod("OFFLINE");
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not load refund details");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statementId, initialKey]);

  const refundableOrders = useMemo(
    () => (context?.orders ?? []).filter((order) => order.remainingGbp > 0.004),
    [context],
  );

  async function submit() {
    if (!context) return;
    setError(null);
    const amountGbp = roundMoney(Number(amount));
    if (!Number.isFinite(amountGbp) || amountGbp <= 0) {
      setError("Enter a refund amount greater than zero.");
      return;
    }
    if (!externalReference.trim()) {
      setError("Enter the refund reference from WeChat, Alipay, or the bank.");
      return;
    }
    if (reason === "OTHER" && !note.trim()) {
      setError("A note is required when the reason is Other.");
      return;
    }
    if (method === "ORIGINAL_CHANNEL" && !paymentOrderId) {
      setError("Choose the paid order.");
      return;
    }

    let allocations: Array<{ offlineWithdrawalRefundId: string; amountGbp: number }> | undefined;
    if (reason === "WITHDRAWAL") {
      const planned = allocateChecked(context.pendingLines, new Set(checkedIds), amountGbp);
      if (planned.allocations.length === 0) {
        setError("Select the withdrawn exams this refund covers.");
        return;
      }
      if (planned.leftover > 0.004) {
        setError("Amount is higher than the selected withdrawal credit.");
        return;
      }
      allocations = planned.allocations;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/fee-statements/${statementId}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          paymentOrderId: method === "ORIGINAL_CHANNEL" ? paymentOrderId : null,
          amountGbp,
          refundedAt,
          externalReference: externalReference.trim(),
          reason,
          note: note.trim() || null,
          allocations,
        }),
      });
      const body = await readJsonResponse<{ summary?: string; error?: string }>(response);
      if (!response.ok) throw new Error(body.error ?? "Could not record refund");
      onSaved(body.summary ?? "Refund recorded.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record refund");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="fee-refund-title"
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="fee-refund-title" className="text-lg font-semibold text-slate-900">
              Record refund
            </h2>
            <p className="text-sm text-slate-500">{statementNo ?? context?.statementNo ?? statementId}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            Close
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm">
          {loadError ? <p className="text-red-700">{loadError}</p> : null}
          {!context && !loadError ? <p className="text-slate-500">Loading...</p> : null}
          {context ? (
            <>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                <p>Collected {formatMoney(context.collectedGbp, "GBP")}</p>
                <p>Already refunded {formatMoney(context.alreadyRefundedGbp, "GBP")}</p>
                <p>Refundable {formatMoney(context.refundableGbp, "GBP")}</p>
                <p>
                  Refund due {formatMoney(context.refundDueGbp, "GBP")} ·{" "}
                  {feeRefundStatusLabel(context.refundStatus)}
                </p>
              </div>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-slate-600">Method</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="refund-method"
                    checked={method === "ORIGINAL_CHANNEL"}
                    disabled={refundableOrders.length === 0}
                    onChange={() => setMethod("ORIGINAL_CHANNEL")}
                  />
                  Original channel (WeChat / Alipay, already refunded outside this system)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="refund-method"
                    checked={method === "OFFLINE"}
                    onChange={() => setMethod("OFFLINE")}
                  />
                  Offline
                </label>
              </fieldset>
              {method === "ORIGINAL_CHANNEL" ? (
                <label className="block">
                  <span className="mb-1 block text-slate-600">Paid order</span>
                  <select
                    value={paymentOrderId}
                    onChange={(event) => setPaymentOrderId(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    {refundableOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {channelLabel(order.channel)} · {order.partnerOrderId} · paid{" "}
                        {formatMoney(order.amountGbp, "GBP")} · left{" "}
                        {formatMoney(order.remainingGbp, "GBP")}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-slate-600">Amount (GBP)</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-slate-600">Refund date</span>
                  <input
                    type="date"
                    value={refundedAt}
                    onChange={(event) => setRefundedAt(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-slate-600">External reference</span>
                <input
                  value={externalReference}
                  onChange={(event) => setExternalReference(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="WeChat / Alipay refund id, or bank reference"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-slate-600">Reason</span>
                <select
                  value={reason}
                  onChange={(event) =>
                    setReason(event.target.value as "WITHDRAWAL" | "OVERPAYMENT" | "OTHER")
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="WITHDRAWAL">Withdrawal</option>
                  <option value="OVERPAYMENT">Overpayment</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              {reason === "WITHDRAWAL" && context.pendingLines.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-slate-600">Withdrawn exams</p>
                  {context.pendingLines.map((line) => (
                    <label key={line.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checkedIds.includes(line.id)}
                        onChange={(event) => {
                          setCheckedIds((current) =>
                            event.target.checked
                              ? [...current, line.id]
                              : current.filter((id) => id !== line.id),
                          );
                        }}
                      />
                      <span>
                        <span className="font-medium text-slate-900">
                          {line.paperCode} {line.subject}
                        </span>
                        <span className="block text-slate-500">
                          Left {formatMoney(line.remainingGbp, "GBP")}
                          {line.allocatedGbp > 0
                            ? ` (of ${formatMoney(line.creditGbp, "GBP")})`
                            : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-slate-600">
                  Note{reason === "OTHER" ? "" : " (optional)"}
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              {error ? <p className="text-red-700">{error}</p> : null}
            </>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !context || context.refundableGbp <= 0.004}
            onClick={() => void submit()}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save refund"}
          </button>
        </div>
      </div>
    </div>
  );
}
