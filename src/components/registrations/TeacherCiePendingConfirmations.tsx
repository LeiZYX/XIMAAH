"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";

type PendingRow = {
  id: string;
  syllabusCode: string;
  optionCode: string;
  createdAt: string;
  subject: { name: string; code: string };
  candidate: {
    englishName: string;
    studentNumber: string | null;
    grade: string | null;
    className: string | null;
  };
  registrationWindow: { title: string };
};

export function TeacherCiePendingConfirmations() {
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cie/subject-confirmations");
      const data = (await res.json()) as { pending?: PendingRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load pending CIE confirmations");
      setPending(data.pending ?? []);
    } catch (err) {
      setPending([]);
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(assignmentId: string, approve: boolean) {
    let reason: string | undefined;
    if (!approve) {
      reason = window.prompt("Rejection reason") ?? undefined;
      if (!reason?.trim()) return;
    }
    setActingId(assignmentId);
    setError(null);
    try {
      const res = await fetch("/api/cie/subject-confirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, approve, reason }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActingId(null);
    }
  }

  if (loading && pending.length === 0) return null;
  if (!loading && pending.length === 0 && !error) return null;

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">CIE entries awaiting confirmation</h2>
        <p className="text-sm text-slate-600">Approve or reject syllabus options for your subjects.</p>
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-2 py-2 font-medium">Student</th>
              <th className="px-2 py-2 font-medium">Entry</th>
              <th className="px-2 py-2 font-medium">Window</th>
              <th className="px-2 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-2 py-2">
                  {row.candidate.englishName}
                  {row.candidate.studentNumber ? ` (${row.candidate.studentNumber})` : ""}
                </td>
                <td className="px-2 py-2">
                  {row.syllabusCode}/{row.optionCode} · {row.subject.name}
                </td>
                <td className="px-2 py-2">{row.registrationWindow.title}</td>
                <td className="px-2 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actingId === row.id}
                      onClick={() => void act(row.id, true)}
                      className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={actingId === row.id}
                      onClick={() => void act(row.id, false)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
