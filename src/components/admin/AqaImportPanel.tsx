"use client";

import { FormEvent, useState } from "react";
import { Card } from "@/components/ui/Card";

interface AqaImportResult {
  source: string;
  rowsParsed: number;
  qualifications: number;
  subjects: number;
  papers: number;
  examSessions: number;
  skippedSessions: number;
  errors: string[];
}

export function AqaImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AqaImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose an AQA timetable PDF first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/import/aqa", {
        method: "POST",
        body: formData,
      });
      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : null;
      if (!response.ok) {
        throw new Error(
          (data && typeof data.error === "string" && data.error) ||
            `AQA import failed (${response.status})`,
        );
      }
      if (!data) {
        throw new Error("Server returned an unexpected response.");
      }
      setResult(data);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "AQA import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mb-6">
      <h2 className="text-lg font-semibold text-slate-900">AQA timetable (PDF)</h2>
      <p className="mt-1 text-sm text-slate-600">
        Upload the official AQA exam timetable PDF (May/June series). Timed papers with am/pm slots
        are imported as exam sessions.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">PDF file</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600"
          />
        </label>

        <button
          type="submit"
          disabled={loading || !file}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Importing..." : "Import AQA PDF"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {result ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">{result.source}</p>
          <p className="mt-2">
            Parsed {result.rowsParsed} rows · Created {result.examSessions} sessions · Skipped{" "}
            {result.skippedSessions} duplicates
          </p>
          <p className="mt-1">
            New qualifications {result.qualifications} · subjects {result.subjects} · papers{" "}
            {result.papers}
          </p>
          {result.errors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-red-600">
              {result.errors.slice(0, 10).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
