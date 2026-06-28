"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface WorkspaceRow {
  id: string;
  student: { name: string; studentNo: string | null };
  registrationWindow: { title: string };
  registrations: Array<{ id: string }>;
}

export function PostLockAdjustmentPickerModal({
  workspacesApiPath,
  detailBasePath,
  onClose,
}: {
  workspacesApiPath: string;
  detailBasePath: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${workspacesApiPath}?lockedOnly=true`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [workspacesApiPath]);

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      row.student.name.toLowerCase().includes(q) ||
      (row.student.studentNo?.toLowerCase().includes(q) ?? false) ||
      row.registrationWindow.title.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Adjust locked registration</h2>
        <p className="mt-1 text-sm text-slate-600">
          Select a locked registration workspace to add, remove, or replace exam sessions.
        </p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search student or window"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-slate-200">
          {loading ? (
            <p className="px-3 py-2 text-sm text-slate-500">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No locked registrations found.</p>
          ) : (
            filtered.map((row) => (
              <Link
                key={row.id}
                href={`${detailBasePath}/${row.id}`}
                onClick={onClose}
                className="block border-b border-slate-100 px-3 py-3 text-sm hover:bg-indigo-50"
              >
                <span className="font-medium text-slate-900">{row.student.name}</span>
                {row.student.studentNo ? (
                  <span className="text-slate-500"> · {row.student.studentNo}</span>
                ) : null}
                <span className="mt-1 block text-slate-600">
                  {row.registrationWindow.title} · {row.registrations.length} exam(s)
                </span>
              </Link>
            ))
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
