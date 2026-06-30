"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";

interface BoardRegistrationRow {
  id: string;
  registered: boolean;
  registrationFeePaid: boolean;
  registrationFeePaidAt?: string | null;
  candidate?: { englishName: string; assessmentHubCandidateNumber: string };
  examBoard?: { name: string; code: string };
  feeStatement?: { statementNo: string; status: string } | null;
}

export function CandidateBoardRegistrationsList() {
  const [rows, setRows] = useState<BoardRegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/candidate-board-registrations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRows(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Board Registration"
        description="One-time candidate registration fee status per exam board. Used when generating registration fee statements."
      />

      <div className="border border-slate-200 bg-white">
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No candidate board registrations recorded yet. Records are created when registration
            fee statements are generated.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Candidate</th>
                  <th className="px-4 py-2">Exam board</th>
                  <th className="px-4 py-2">Registered</th>
                  <th className="px-4 py-2">Fee paid</th>
                  <th className="px-4 py-2">Statement</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      {row.candidate?.englishName ?? "—"}
                      <span className="block text-xs text-slate-500">
                        {row.candidate?.assessmentHubCandidateNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.examBoard?.name ?? "—"}</td>
                    <td className="px-4 py-3">{row.registered ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">
                      {row.registrationFeePaid
                        ? `Yes${row.registrationFeePaidAt ? ` · ${new Date(row.registrationFeePaidAt).toLocaleDateString()}` : ""}`
                        : "No"}
                    </td>
                    <td className="px-4 py-3">
                      {row.feeStatement
                        ? `${row.feeStatement.statementNo} (${row.feeStatement.status})`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
