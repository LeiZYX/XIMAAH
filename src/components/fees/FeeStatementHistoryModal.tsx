"use client";

import { useEffect, useState } from "react";
import { readJsonResponse } from "@/lib/client/fetch-json";
import {
  feeStatementEventActorLabel,
  feeStatementEventLabel,
} from "@/lib/fees/statement-event-labels";
import { feePaymentPaidLabel } from "@/lib/fees/payment-settlement";
import { feeStatementStatusLabel } from "@/lib/fees/workspace-status";

interface HistoryEvent {
  id: string;
  kind: string;
  occurredAt: string;
  summary: string;
  paymentOrderId: string | null;
  actorName: string | null;
}

interface HistoryResponse {
  statement: {
    statementNo: string;
    status: string;
    paymentSettlement: string;
    studentNameSnapshot: string;
  };
  events: HistoryEvent[];
  error?: string;
}

export function FeeStatementHistoryModal({
  statementId,
  candidateLabel,
  onClose,
}: {
  statementId: string;
  candidateLabel: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(`/api/fee-statements/${statementId}/events`);
        const body = await readJsonResponse<HistoryResponse>(response);
        if (!response.ok) throw new Error(body.error ?? "Could not load history");
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : "Could not load history");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statementId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="fee-statement-history-title"
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="fee-statement-history-title" className="text-lg font-semibold text-slate-900">
              Statement history
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {data?.statement.statementNo ?? "Fee statement"} · {candidateLabel}
            </p>
            {data?.statement ? (
              <p className="mt-1 text-xs text-slate-500">
                {feeStatementStatusLabel(data.statement.status)} ·{" "}
                {feePaymentPaidLabel(data.statement.status, data.statement.paymentSettlement)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {loading ? <p className="text-sm text-slate-500">Loading history…</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {!loading && !error && data && data.events.length === 0 ? (
            <p className="text-sm text-slate-500">No activity recorded for this statement yet.</p>
          ) : null}
          {!loading && !error && data && data.events.length > 0 ? (
            <ol className="space-y-3">
              {data.events.map((event) => (
                <li key={event.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      {feeStatementEventLabel(event.kind)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(event.occurredAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{event.summary}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {feeStatementEventActorLabel(event.kind, event.actorName)}
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
    </div>
  );
}
