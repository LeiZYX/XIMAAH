"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatAdjusterLabel } from "@/lib/registrations/workspace-display";

interface WorkspaceRow {
  id: string;
  lockedAt: string | null;
  hasPostLockAdjustment: boolean;
  lastAdjustedAt: string | null;
  student: { name: string };
  registrationWindow: {
    title: string;
    examBoard: { name: string };
    examSeries: { name: string; year: number };
  };
  registrations: Array<{ id: string }>;
  lastAdjustedByUser: { name: string } | null;
  lastAdjustedByRole: string | null;
  changeRequests: Array<{ id: string; status: string }>;
}

export function RegistrationWorkspaceList({
  apiPath,
  detailBasePath,
}: {
  apiPath: string;
  detailBasePath: string;
}) {
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${apiPath}?lockedOnly=true`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [apiPath]);

  const pendingCount = (row: WorkspaceRow) =>
    row.changeRequests.filter((request) => request.status === "PENDING").length;

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">
        Locked registrations (by student &amp; window)
      </h2>
      <p className="mb-3 text-sm text-slate-600">
        Open a registration to review teacher change requests, adjust exams, or print confirmation.
      </p>
      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          No locked registrations yet. Registrations appear here after a registration window closes
          and student exams are locked.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-4 font-medium">Student</th>
                <th className="py-2 pr-4 font-medium">Registration</th>
                <th className="py-2 pr-4 font-medium">Exams</th>
                <th className="py-2 pr-4 font-medium">Pending requests</th>
                <th className="py-2 pr-4 font-medium">Adjusted</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pending = pendingCount(row);
                return (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{row.student.name}</td>
                    <td className="py-2 pr-4">
                      {row.registrationWindow.title}
                      <span className="block text-xs text-slate-500">
                        {row.registrationWindow.examBoard.name} ·{" "}
                        {row.registrationWindow.examSeries.name}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{row.registrations.length}</td>
                    <td className="py-2 pr-4">
                      {pending > 0 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {pending} pending
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {row.hasPostLockAdjustment
                        ? formatAdjusterLabel(
                            row.lastAdjustedByUser?.name,
                            row.lastAdjustedByRole as never,
                          )
                        : "—"}
                    </td>
                    <td className="py-2">
                      <Link
                        href={`${detailBasePath}/${row.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Open detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
