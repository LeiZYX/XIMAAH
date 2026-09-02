"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";

export interface CashInAuditEntryRow {
  id: string;
  source: "POST_RESULTS" | "FEE";
  action: string;
  actionLabel: string;
  performedAt: string;
  performedByName: string | null;
  details: string | null;
  candidateName: string | null;
  examBoardCode: string | null;
  examSeriesLabel: string | null;
}

export function CashInAuditLogPanel({
  title = "Cash-in audit log",
  description = "Post-results and fee audit entries for cash-in (including offline payment marking).",
  limit = 50,
  refreshKey = 0,
}: {
  title?: string;
  description?: string;
  limit?: number;
  /** Change this value to force a reload (e.g. after Mark paid offline). */
  refreshKey?: number;
}) {
  const [entries, setEntries] = useState<CashInAuditEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cash-in-requests/audit-log?limit=${limit}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load audit log");
      }
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      setEntries([]);
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-600">Loading audit entries…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-600">No cash-in audit entries yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">By</th>
                <th className="px-3 py-2">Candidate / context</th>
                <th className="px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {new Date(entry.performedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.source === "FEE"
                          ? "bg-amber-50 text-amber-900"
                          : "bg-indigo-50 text-indigo-900"
                      }`}
                    >
                      {entry.source === "FEE" ? "FeeAuditLog" : "PostResultsAuditLog"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{entry.actionLabel}</div>
                    <div className="font-mono text-[11px] text-slate-400">{entry.action}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{entry.performedByName ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {entry.candidateName ?? "—"}
                    {entry.examBoardCode || entry.examSeriesLabel ? (
                      <div className="text-xs text-slate-500">
                        {[entry.examBoardCode, entry.examSeriesLabel].filter(Boolean).join(" · ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-slate-600">{entry.details ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
