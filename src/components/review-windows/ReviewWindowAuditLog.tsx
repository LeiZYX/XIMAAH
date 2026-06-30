"use client";

import { useEffect, useState } from "react";
import { ReviewWindowDetailShell } from "@/components/review-windows/ReviewWindowDetailShell";

interface AuditRow {
  id: string;
  actionLabel: string;
  performedAt: string;
  serviceType?: string | null;
  notes?: string | null;
  reason?: string | null;
  performedBy?: { name: string };
}

interface ReviewWindowAuditLogProps {
  windowId: string;
  basePath: "/admin/review-windows" | "/exam-office/review-windows";
  feeStatementsBasePath: "/admin/fee-statements" | "/exam-office/fee-statements";
}

export function ReviewWindowAuditLog({
  windowId,
  basePath,
  feeStatementsBasePath,
}: ReviewWindowAuditLogProps) {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/review-windows/${windowId}/audit-log`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setLogs(data))
      .finally(() => setLoading(false));
  }, [windowId]);

  return (
    <ReviewWindowDetailShell
      windowId={windowId}
      basePath={basePath}
      feeStatementsBasePath={feeStatementsBasePath}
    >
      <div className="border border-slate-200 bg-white">
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No audit entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">By</th>
                  <th className="px-4 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(log.performedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{log.actionLabel}</td>
                    <td className="px-4 py-3">{log.performedBy?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {[log.serviceType, log.notes, log.reason].filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ReviewWindowDetailShell>
  );
}
