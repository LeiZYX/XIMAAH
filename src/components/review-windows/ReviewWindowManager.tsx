"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { datetimeLocalValueToIso } from "@/lib/datetime-local";
import {
  REVIEW_WINDOW_STATUS_OPTIONS,
  reviewWindowStatusLabel,
} from "@/lib/post-results/constants";

interface WindowRow {
  id: string;
  title: string;
  openAt: string;
  closeAt: string;
  status: string;
  examBoard?: { id: string; name: string; code: string };
  examSeries?: { id: string; name: string; year: number };
  _count?: {
    reviewRequests: number;
    cashInRequests: number;
    accessToScriptRequests: number;
    certificateRequests: number;
  };
}

interface ExamBoardOption {
  id: string;
  name: string;
  code: string;
}

interface ExamSeriesOption {
  id: string;
  name: string;
  year: number;
  examBoardId: string;
}

export interface ReviewWindowManagerProps {
  basePath?: "/admin/review-windows" | "/exam-office/review-windows";
}

function formatListDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ReviewWindowManager({
  basePath = "/admin/review-windows",
}: ReviewWindowManagerProps) {
  const [windows, setWindows] = useState<WindowRow[]>([]);
  const [examBoards, setExamBoards] = useState<ExamBoardOption[]>([]);
  const [examSeries, setExamSeries] = useState<ExamSeriesOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [examBoardId, setExamBoardId] = useState("");
  const [examSeriesId, setExamSeriesId] = useState("");
  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [resultsReleaseDate, setResultsReleaseDate] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [notes, setNotes] = useState("");

  async function loadWindows() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/review-windows");
      if (!response.ok) throw new Error("Failed to load review windows");
      setWindows(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWindows();
    fetch("/api/exam-boards")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setExamBoards(data));
    fetch("/api/exam-series")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setExamSeries(data));
  }, []);

  const filteredSeries = examSeries.filter((series) => series.examBoardId === examBoardId);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/review-windows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          examBoardId,
          examSeriesId,
          openAt: datetimeLocalValueToIso(openAt),
          closeAt: datetimeLocalValueToIso(closeAt),
          resultsReleaseDate: resultsReleaseDate
            ? datetimeLocalValueToIso(resultsReleaseDate)
            : null,
          status,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to create review window");
      }

      setTitle("");
      setExamBoardId("");
      setExamSeriesId("");
      setOpenAt("");
      setCloseAt("");
      setResultsReleaseDate("");
      setStatus("DRAFT");
      setNotes("");
      await loadWindows();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Windows"
        description="Manage post-results service periods separately from registration windows."
      />

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleCreate}
        className="space-y-4 border border-slate-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-slate-900">Create review window</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2"
            >
              {REVIEW_WINDOW_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Exam board</span>
            <select
              required
              value={examBoardId}
              onChange={(e) => {
                setExamBoardId(e.target.value);
                setExamSeriesId("");
              }}
              className="w-full border border-slate-300 px-3 py-2"
            >
              <option value="">Select board</option>
              {examBoards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Exam series</span>
            <select
              required
              value={examSeriesId}
              onChange={(e) => setExamSeriesId(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2"
              disabled={!examBoardId}
            >
              <option value="">Select series</option>
              {filteredSeries.map((series) => (
                <option key={series.id} value={series.id}>
                  {series.name} ({series.year})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Open at</span>
            <input
              required
              type="datetime-local"
              value={openAt}
              onChange={(e) => setOpenAt(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Close at</span>
            <input
              required
              type="datetime-local"
              value={closeAt}
              onChange={(e) => setCloseAt(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">
              Results release date (optional)
            </span>
            <input
              type="datetime-local"
              value={resultsReleaseDate}
              onChange={(e) => setResultsReleaseDate(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create review window"}
        </button>
      </form>

      <div className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">All review windows</h2>
        </div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
        ) : windows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No review windows yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Board</th>
                  <th className="px-4 py-2">Series</th>
                  <th className="px-4 py-2">Open</th>
                  <th className="px-4 py-2">Close</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Requests</th>
                </tr>
              </thead>
              <tbody>
                {windows.map((window) => (
                  <tr key={window.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link
                        href={`${basePath}/${window.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {window.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{window.examBoard?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {window.examSeries
                        ? `${window.examSeries.name} (${window.examSeries.year})`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{formatListDate(window.openAt)}</td>
                    <td className="px-4 py-3">{formatListDate(window.closeAt)}</td>
                    <td className="px-4 py-3">{reviewWindowStatusLabel(window.status)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {(window._count?.reviewRequests ?? 0) +
                        (window._count?.cashInRequests ?? 0) +
                        (window._count?.accessToScriptRequests ?? 0) +
                        (window._count?.certificateRequests ?? 0)}
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
