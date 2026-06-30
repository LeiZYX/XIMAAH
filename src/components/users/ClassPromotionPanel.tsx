"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsersSubnav } from "@/components/users/UsersSubnav";
import { USERS_MODULE_DESCRIPTION } from "@/lib/navigation/module-descriptions";

interface PromotionStudent {
  id: string;
  name: string;
  studentNo: string | null;
  currentGrade: string | null;
  currentClassName: string | null;
  targetGrade: string | null;
  targetClassName: string | null;
  archiveStatus: string | null;
}

const inputClass = "rounded border border-slate-300 px-3 py-2 text-sm";
const buttonClass =
  "rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
const primaryButtonClass =
  "rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";

export function ClassPromotionPanel() {
  const [sourceGrade, setSourceGrade] = useState("");
  const [sourceClassName, setSourceClassName] = useState("");
  const [targetGrade, setTargetGrade] = useState("");
  const [targetClassName, setTargetClassName] = useState("");
  const [archiveStatus, setArchiveStatus] = useState("");
  const [students, setStudents] = useState<PromotionStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const promotionPayload = useMemo(
    () => ({
      sourceGrade: sourceGrade.trim(),
      sourceClassName: sourceClassName.trim() || undefined,
      targetGrade: targetGrade.trim() || undefined,
      targetClassName: targetClassName.trim() || undefined,
      archiveStatus:
        archiveStatus === "ACTIVE" ||
        archiveStatus === "GRADUATED" ||
        archiveStatus === "LEFT" ||
        archiveStatus === "INACTIVE"
          ? archiveStatus
          : undefined,
    }),
    [archiveStatus, sourceClassName, sourceGrade, targetClassName, targetGrade],
  );

  const allSelected = students.length > 0 && students.every((row) => selectedIds.has(row.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(students.map((row) => row.id)));
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function preview() {
    if (!promotionPayload.sourceGrade) {
      setError("Source grade is required.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/users/promotion/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promotionPayload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Preview failed");
      }
      const rows = Array.isArray(data.students) ? (data.students as PromotionStudent[]) : [];
      setStudents(rows);
      setSelectedIds(new Set(rows.map((row) => row.id)));
    } catch (previewError) {
      setStudents([]);
      setSelectedIds(new Set());
      setError(previewError instanceof Error ? previewError.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!promotionPayload.sourceGrade) {
      setError("Source grade is required.");
      return;
    }
    const studentIds = Array.from(selectedIds);
    if (studentIds.length === 0) {
      setError("Select at least one student.");
      return;
    }

    setCommitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/users/promotion/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...promotionPayload, studentIds }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Promotion failed");
      }
      const updated = typeof data.updated === "number" ? data.updated : studentIds.length;
      setMessage(`Promotion complete for ${updated} student(s).`);
      setStudents([]);
      setSelectedIds(new Set());
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : "Promotion failed");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <UsersSubnav />
      <PageHeader
        title="Class Promotion"
        description={`${USERS_MODULE_DESCRIPTION} Move active students to a new grade/class or archive them in bulk.`}
      />

      <div className="space-y-4 border border-slate-200 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Source grade *
            <input
              value={sourceGrade}
              onChange={(e) => setSourceGrade(e.target.value)}
              className={inputClass}
              placeholder="e.g. 10"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Source class
            <input
              value={sourceClassName}
              onChange={(e) => setSourceClassName(e.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Target grade
            <input
              value={targetGrade}
              onChange={(e) => setTargetGrade(e.target.value)}
              className={inputClass}
              placeholder="Leave blank to keep"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Target class
            <input
              value={targetClassName}
              onChange={(e) => setTargetClassName(e.target.value)}
              className={inputClass}
              placeholder="Leave blank to keep"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Archive status (optional)
            <select
              value={archiveStatus}
              onChange={(e) => setArchiveStatus(e.target.value)}
              className={inputClass}
            >
              <option value="">No change</option>
              <option value="ACTIVE">Active</option>
              <option value="GRADUATED">Graduated</option>
              <option value="LEFT">Left</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void preview()}
            disabled={loading || committing}
            className={buttonClass}
          >
            {loading ? "Loading preview..." : "Preview"}
          </button>
          <button
            type="button"
            onClick={() => void commit()}
            disabled={committing || students.length === 0 || selectedIds.size === 0}
            className={primaryButtonClass}
          >
            {committing ? "Committing..." : `Confirm promotion (${selectedIds.size})`}
          </button>
        </div>

        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {students.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-slate-200 text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-600">
                  <th className="border border-slate-200 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all students"
                    />
                  </th>
                  <th className="border border-slate-200 px-3 py-2">Student No.</th>
                  <th className="border border-slate-200 px-3 py-2">Name</th>
                  <th className="border border-slate-200 px-3 py-2">Current</th>
                  <th className="border border-slate-200 px-3 py-2">Target</th>
                  <th className="border border-slate-200 px-3 py-2">Archive status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200">
                    <td className="border border-slate-200 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.name}`}
                      />
                    </td>
                    <td className="border border-slate-200 px-3 py-2">{row.studentNo ?? "—"}</td>
                    <td className="border border-slate-200 px-3 py-2">{row.name}</td>
                    <td className="border border-slate-200 px-3 py-2">
                      {row.currentGrade ?? "—"} / {row.currentClassName ?? "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {row.targetGrade ?? "—"} / {row.targetClassName ?? "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {row.archiveStatus ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
