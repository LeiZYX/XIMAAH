"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";

interface TimetableOption {
  id: string;
  label: string;
  seriesName: string;
  year: number;
  qualificationLevel: string;
}

interface EdexcelImportResult {
  source: string;
  rowsParsed: number;
  qualifications: number;
  subjects: number;
  papers: number;
  examSessions: number;
  skippedSessions: number;
  errors: string[];
}

export function EdexcelImportPanel() {
  const [timetables, setTimetables] = useState<TimetableOption[]>([]);
  const [timetableId, setTimetableId] = useState("gcse-summer-2026");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EdexcelImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/import/edexcel")
      .then((response) => response.json())
      .then((data) => setTimetables(data.timetables ?? []))
      .catch(() => setError("Could not load Edexcel timetable list"));
  }, []);

  async function handleImport(all = false) {
    setLoading(true);
    setError(null);
    setResult(null);

    const subjects = subjectFilter
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (all) {
      const aggregated: EdexcelImportResult = {
        source: "All Edexcel timetables",
        rowsParsed: 0,
        qualifications: 0,
        subjects: 0,
        papers: 0,
        examSessions: 0,
        skippedSessions: 0,
        errors: [],
      };

      for (const item of timetables) {
        const response = await fetch("/api/import/edexcel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timetableId: item.id }),
        });
        const data = await response.json();
        if (!response.ok) {
          aggregated.errors.push(`${item.label}: ${data.error || "failed"}`);
          continue;
        }
        aggregated.rowsParsed += data.rowsParsed;
        aggregated.qualifications += data.qualifications;
        aggregated.subjects += data.subjects;
        aggregated.papers += data.papers;
        aggregated.examSessions += data.examSessions;
        aggregated.skippedSessions += data.skippedSessions;
        aggregated.errors.push(...data.errors);
      }

      setLoading(false);
      setResult(aggregated);
      return;
    }

    const response = await fetch("/api/import/edexcel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timetableId,
        subjects: subjects.length ? subjects : undefined,
      }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Import failed");
      return;
    }

    setResult(data);
  }

  return (
    <Card className="mb-6 border-emerald-200 bg-emerald-50">
      <h2 className="text-lg font-semibold text-emerald-900">Edexcel auto-import</h2>
      <p className="mt-1 text-sm text-emerald-800">
        Downloads the official Pearson Edexcel XLSX timetable and imports qualifications,
        subjects, papers, and exam sessions automatically.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-emerald-900">Timetable</span>
          <select
            value={timetableId}
            onChange={(event) => setTimetableId(event.target.value)}
            className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
          >
            {timetables.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-emerald-900">
            Subject filter (optional)
          </span>
          <input
            type="text"
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
            placeholder="Mathematics, Biology"
            className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-emerald-700">
            Leave empty to import all subjects in the timetable
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleImport(false)}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Importing..." : "Import selected timetable"}
        </button>
        <button
          type="button"
          onClick={() => handleImport(true)}
          disabled={loading}
          className="rounded-lg border border-emerald-600 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          Import all timetables
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Imported from {result.source}</p>
          <ul className="mt-2 space-y-1">
            <li>{result.rowsParsed} exam rows parsed</li>
            <li>{result.qualifications} new qualifications</li>
            <li>{result.subjects} new subjects</li>
            <li>{result.papers} new papers</li>
            <li>{result.examSessions} exam sessions created</li>
            <li>{result.skippedSessions} sessions skipped (already exist)</li>
          </ul>
          {result.errors.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-red-600">
              {result.errors.slice(0, 10).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-emerald-800">
            Open the Calendar and filter by exam board <strong>EDEXCEL</strong> to view sessions.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
