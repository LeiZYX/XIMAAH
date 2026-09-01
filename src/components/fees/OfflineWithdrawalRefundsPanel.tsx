"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type RefundRow = {
  id: string;
  status: "PENDING_OFFLINE" | "COMPLETED" | "ZERO_NO_REFUND";
  paperCodeSnapshot: string;
  subjectSnapshot: string;
  feeStageCode: string;
  salesAmountGbp: number;
  configuredRefundPercent: number;
  paymentFeePercent: number;
  effectiveRefundPercent: number;
  creditGbp: number;
  calculationNotes: string | null;
  offlineReference: string | null;
  offlineNote: string | null;
  createdAt: string;
  completedAt: string | null;
  candidate: {
    englishName: string;
    studentNumber: string | null;
    assessmentHubCandidateNumber: string;
  } | null;
  registrationWindow: { title: string; academicYear: string };
  registrationWorkspace: { registrationNumber: string | null };
  createdByUser: { name: string };
  completedByUser: { name: string } | null;
};

function statusLabel(status: RefundRow["status"]) {
  switch (status) {
    case "PENDING_OFFLINE":
      return "Pending offline refund";
    case "COMPLETED":
      return "Completed offline";
    case "ZERO_NO_REFUND":
      return "No refund due";
    default:
      return status;
  }
}

export function OfflineWithdrawalRefundsPanel({ basePath }: { basePath: "/admin" | "/exam-office" }) {
  const [status, setStatus] = useState<"PENDING_OFFLINE" | "COMPLETED" | "ZERO_NO_REFUND" | "ALL">(
    "PENDING_OFFLINE",
  );
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/offline-withdrawal-refunds?status=${status}`);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Failed to load offline refunds");
      setRows([]);
      setLoading(false);
      return;
    }
    setRows(await response.json());
    setLoading(false);
  }, [status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  async function markCompleted(id: string) {
    setCompletingId(id);
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/offline-withdrawal-refunds/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offlineReference: reference.trim() || undefined,
        offlineNote: note.trim() || undefined,
      }),
    });
    setCompletingId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not mark refund completed");
      return;
    }
    setReference("");
    setNote("");
    setMessage("Marked as refunded offline. No payment-platform refund was sent.");
    await load();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Offline withdrawal refunds"
        description="Credits calculated when exams are removed. Finance refunds students on an external platform; this page only tracks pending vs completed. GlobePay is never used for refunds."
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="PENDING_OFFLINE">Pending offline</option>
              <option value="COMPLETED">Completed</option>
              <option value="ZERO_NO_REFUND">No refund due</option>
              <option value="ALL">All</option>
            </select>
          </label>
          <p className="text-xs text-slate-500">
            List context: {basePath.replace("/", "")} fee management
          </p>
        </div>

        {message ? (
          <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
        ) : null}
        {error ? (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}

        {status === "PENDING_OFFLINE" ? (
          <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Offline reference (optional)</span>
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Bank transfer / finance ticket #"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Note (optional)</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Refunded outside system"
              />
            </label>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-600">No records for this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Student</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Paper</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Stage</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Sales</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Effective %</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Credit</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">
                        {row.candidate?.englishName ?? "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.candidate?.studentNumber ??
                          row.candidate?.assessmentHubCandidateNumber ??
                          "—"}
                        {" · "}
                        {row.registrationWindow.title}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs">{row.paperCodeSnapshot}</div>
                      <div className="text-xs text-slate-500">{row.subjectSnapshot}</div>
                    </td>
                    <td className="px-3 py-2">{row.feeStageCode}</td>
                    <td className="px-3 py-2 text-right">£{row.salesAmountGbp.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{row.effectiveRefundPercent}%</td>
                    <td className="px-3 py-2 text-right font-medium">£{row.creditGbp.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <div>{statusLabel(row.status)}</div>
                      {row.offlineReference ? (
                        <div className="text-xs text-slate-500">Ref: {row.offlineReference}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.status === "PENDING_OFFLINE" ? (
                        <button
                          type="button"
                          disabled={completingId === row.id}
                          onClick={() => markCompleted(row.id)}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {completingId === row.id ? "Saving…" : "Mark refunded offline"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
