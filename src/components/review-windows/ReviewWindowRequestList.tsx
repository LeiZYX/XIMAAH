"use client";

import { useEffect, useState } from "react";
import { ReviewWindowDetailShell } from "@/components/review-windows/ReviewWindowDetailShell";

interface RequestRow {
  id: string;
  status: string;
  createdAt: string;
  candidate?: { englishName: string; assessmentHubCandidateNumber: string };
}

interface ReviewWindowRequestListProps {
  windowId: string;
  basePath: "/admin/review-windows" | "/exam-office/review-windows";
  feeStatementsBasePath: "/admin/fee-statements" | "/exam-office/fee-statements";
  apiPath: string;
  title: string;
  emptyMessage: string;
}

export function ReviewWindowRequestList({
  windowId,
  basePath,
  feeStatementsBasePath,
  apiPath,
  title,
  emptyMessage,
}: ReviewWindowRequestListProps) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/review-windows/${windowId}/${apiPath}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRequests(data))
      .finally(() => setLoading(false));
  }, [windowId, apiPath]);

  return (
    <ReviewWindowDetailShell
      windowId={windowId}
      basePath={basePath}
      feeStatementsBasePath={feeStatementsBasePath}
    >
      <div className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        </div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Candidate</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      {row.candidate?.englishName ?? "—"}
                      <span className="block text-xs text-slate-500">
                        {row.candidate?.assessmentHubCandidateNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">
                      {new Date(row.createdAt).toLocaleString()}
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
