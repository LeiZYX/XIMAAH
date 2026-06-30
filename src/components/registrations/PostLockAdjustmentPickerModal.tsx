"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { registrationTypeLabel } from "@/lib/registrations/metadata";
import {
  workspaceStudentLabel,
  workspaceStudentNo,
} from "@/lib/registrations/workspace-display";

interface WorkspaceRow {
  id: string;
  registrationType: string;
  student: { name: string; studentNo: string | null } | null;
  candidate: {
    englishName: string | null;
    studentNumber: string | null;
  } | null;
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
    fetch(`${workspacesApiPath}?lockedOnly=true&all=true&registrationTypes=INTERNAL_NORMAL`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : data?.workspaces ?? []))
      .finally(() => setLoading(false));
  }, [workspacesApiPath]);

  const filtered = rows.filter((row) => {
    if (row.registrationType !== "INTERNAL_NORMAL") return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const name = workspaceStudentLabel(row).toLowerCase();
    const studentNo = workspaceStudentNo(row)?.toLowerCase() ?? "";
    return (
      name.includes(q) ||
      studentNo.includes(q) ||
      row.registrationWindow.title.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Adjust locked registration</h2>
        <p className="mt-1 text-sm text-slate-600">
          Select a locked internal normal registration to add, remove, or replace exam sessions.
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
                <span className="font-medium text-slate-900">{workspaceStudentLabel(row)}</span>
                {workspaceStudentNo(row) ? (
                  <span className="text-slate-500"> · {workspaceStudentNo(row)}</span>
                ) : null}
                {row.registrationType !== "INTERNAL_NORMAL" ? (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {registrationTypeLabel(row.registrationType)}
                  </span>
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
