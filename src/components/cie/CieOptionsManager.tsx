"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { isCieExamBoard } from "@/lib/exam-boards/branch";

type ExamBoard = { id: string; code: string; name: string };
type ExamSeries = { id: string; name: string; year: number; examBoardId: string };
type OptionRow = {
  id: string;
  syllabusCode: string;
  syllabusTitle: string | null;
  optionCode: string;
  componentCodes: string[];
  disallowedSyllabusCodes: string[];
  subjectId: string | null;
  notes: string | null;
  active: boolean;
};

export function CieOptionsManager() {
  const [boards, setBoards] = useState<ExamBoard[]>([]);
  const [series, setSeries] = useState<ExamSeries[]>([]);
  const [examBoardId, setExamBoardId] = useState("");
  const [examSeriesId, setExamSeriesId] = useState("");
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [syllabusCode, setSyllabusCode] = useState("");
  const [syllabusTitle, setSyllabusTitle] = useState("");
  const [optionCode, setOptionCode] = useState("");
  const [componentCodes, setComponentCodes] = useState("");
  const [disallowed, setDisallowed] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/exam-boards")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ExamBoard[]) => {
        const list = Array.isArray(data) ? data : [];
        const cie = list.filter((b) => isCieExamBoard(b.code, b.name));
        setBoards(cie);
        if (cie[0]) setExamBoardId(cie[0].id);
      })
      .catch(() => setBoards([]));
  }, []);

  useEffect(() => {
    if (!examBoardId) {
      setSeries([]);
      return;
    }
    fetch(`/api/exam-series?examBoardId=${encodeURIComponent(examBoardId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ExamSeries[]) => {
        const list = Array.isArray(data) ? data : [];
        setSeries(list);
        if (list[0]) setExamSeriesId(list[0].id);
        else setExamSeriesId("");
      })
      .catch(() => setSeries([]));
  }, [examBoardId]);

  const loadOptions = useCallback(async () => {
    if (!examSeriesId) {
      setOptions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/cie/options?examSeriesId=${encodeURIComponent(examSeriesId)}`,
      );
      const data = (await res.json()) as { options?: OptionRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load options");
      setOptions(data.options ?? []);
    } catch (err) {
      setOptions([]);
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [examSeriesId]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!examBoardId || !examSeriesId) return;
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/cie/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examBoardId,
          examSeriesId,
          rows: [
            {
              syllabusCode,
              syllabusTitle: syllabusTitle || null,
              optionCode,
              componentCodes: componentCodes
                .split(/[,;\s]+/)
                .map((c) => c.trim())
                .filter(Boolean),
              disallowedSyllabusCodes: disallowed
                .split(/[,;\s]+/)
                .map((c) => c.trim())
                .filter(Boolean),
              notes: notes || null,
              active: true,
            },
          ],
        }),
      });
      const data = (await res.json()) as { error?: string; upserted?: number };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMessage(`Saved ${data.upserted ?? 1} option(s).`);
      setSyllabusCode("");
      setSyllabusTitle("");
      setOptionCode("");
      setComponentCodes("");
      setDisallowed("");
      setNotes("");
      await loadOptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CIE syllabus options"
        description="Maintain Cambridge Direct option catalogues per exam series. Students can only register options listed here."
      />

      <Card className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Exam board</span>
            <select
              value={examBoardId}
              onChange={(e) => setExamBoardId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Exam series</span>
            <select
              value={examSeriesId}
              onChange={(e) => setExamSeriesId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.year})
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Add / update option</h2>
        <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Syllabus code *</span>
            <input
              required
              value={syllabusCode}
              onChange={(e) => setSyllabusCode(e.target.value)}
              placeholder="0452"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Syllabus title</span>
            <input
              value={syllabusTitle}
              onChange={(e) => setSyllabusTitle(e.target.value)}
              placeholder="Accounting"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Option code *</span>
            <input
              required
              value={optionCode}
              onChange={(e) => setOptionCode(e.target.value)}
              placeholder="AY"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Component codes * (comma-separated)</span>
            <input
              required
              value={componentCodes}
              onChange={(e) => setComponentCodes(e.target.value)}
              placeholder="12, 02"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">Disallowed syllabus codes</span>
            <input
              value={disallowed}
              onChange={(e) => setDisallowed(e.target.value)}
              placeholder="0510"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            >
              Save option
            </button>
          </div>
        </form>
        {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </Card>

      <Card className="overflow-x-auto">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Options in series {loading ? "(loading…)" : `(${options.length})`}
        </h2>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-2 py-2 font-medium">Syllabus</th>
              <th className="px-2 py-2 font-medium">Option</th>
              <th className="px-2 py-2 font-medium">Components</th>
              <th className="px-2 py-2 font-medium">Disallowed</th>
              <th className="px-2 py-2 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {options.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-2 py-2">
                  {row.syllabusCode}
                  {row.syllabusTitle ? ` — ${row.syllabusTitle}` : ""}
                </td>
                <td className="px-2 py-2">{row.optionCode}</td>
                <td className="px-2 py-2">{row.componentCodes.join(", ")}</td>
                <td className="px-2 py-2">{row.disallowedSyllabusCodes.join(", ") || "—"}</td>
                <td className="px-2 py-2">{row.active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
