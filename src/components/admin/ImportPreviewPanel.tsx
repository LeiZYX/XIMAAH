"use client";

import { FormEvent, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import type {
  ImportPreviewResponseDto,
  ImportPreviewSource,
  ParseResponseDto,
} from "@/lib/data-processor/types";

interface ImportPreviewPanelProps {
  title: string;
  description: string;
  accept: string;
  previewEndpoint: string;
  source: ImportPreviewSource;
  accent?: "indigo" | "sky" | "violet";
}

interface CommitResult {
  source: string;
  rowsParsed: number;
  qualifications: number;
  subjects: number;
  papers: number;
  examSessions: number;
  skippedSessions: number;
  errors: string[];
}

export function ImportPreviewPanel({
  title,
  description,
  accept,
  previewEndpoint,
  source,
  accent = "indigo",
}: ImportPreviewPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResponseDto | null>(null);
  const [validation, setValidation] = useState<ImportPreviewResponseDto | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/import/preview/status")
      .then((response) => response.json())
      .then((data) => setServiceAvailable(Boolean(data.available)))
      .catch(() => setServiceAvailable(false));
  }, []);

  async function handlePreview(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setParsed(null);
    setValidation(null);
    setCommitResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(previewEndpoint, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Preview failed");
      setParsed(data.parsed);
      setValidation(data.validation);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!parsed || !validation?.valid) return;

    setCommitting(true);
    setError(null);

    try {
      const response = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          rows: parsed.rows,
          meta: parsed.meta,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Import failed");
      setCommitResult(data);
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : "Import failed");
    } finally {
      setCommitting(false);
    }
  }

  const borderClass =
    accent === "sky"
      ? "border-sky-200 bg-sky-50"
      : accent === "violet"
        ? "border-violet-200 bg-violet-50"
        : "border-indigo-200 bg-indigo-50";

  return (
    <Card className={`mb-6 ${borderClass}`}>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-700">{description}</p>

      {serviceAvailable === false ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Python data-processor is offline. Start it with{" "}
          <code className="rounded bg-white px-1">uvicorn app.main:app --port 8001</code> in{" "}
          <code className="rounded bg-white px-1">services/data-processor</code>.
        </p>
      ) : null}

      <form onSubmit={handlePreview} className="mt-4 space-y-4">
        <input
          type="file"
          accept={accept}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600"
        />
        <button
          type="submit"
          disabled={loading || !file || serviceAvailable === false}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Parsing..." : "Preview import"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {parsed && validation ? (
        <div className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <div>
            <p className="font-medium text-slate-900">
              Parsed {parsed.row_count} rows from {parsed.meta.source_filename ?? parsed.source}
            </p>
            <p className="mt-1 text-slate-600">
              {validation.summary.qualifications} qualifications · {validation.summary.subjects}{" "}
              subjects · {validation.summary.papers} papers · {validation.summary.sessions} sessions
            </p>
            <p className="mt-1">
              Validation:{" "}
              <span className={validation.valid ? "text-green-700" : "text-red-700"}>
                {validation.valid ? "Ready to import" : "Fix errors before import"}
              </span>
            </p>
          </div>

          {validation.ai_notes.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-slate-600">
              {validation.ai_notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}

          {validation.issues.length > 0 ? (
            <ul className="max-h-40 overflow-y-auto list-disc space-y-1 pl-5 text-red-600">
              {validation.issues.slice(0, 20).map((issue, index) => (
                <li key={`${issue.message}-${index}`}>
                  {issue.row_index !== null ? `Row ${issue.row_index + 1}: ` : ""}
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="max-h-48 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Subject</th>
                  <th className="py-1 pr-2">Paper</th>
                  <th className="py-1 pr-2">Title</th>
                  <th className="py-1 pr-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 15).map((row, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td className="py-1 pr-2">{row.date}</td>
                    <td className="py-1 pr-2">{row.subject}</td>
                    <td className="py-1 pr-2">{row.paper_code}</td>
                    <td className="py-1 pr-2">{row.title}</td>
                    <td className="py-1 pr-2">{row.start_time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.rows.length > 15 ? (
              <p className="mt-2 text-xs text-slate-500">
                Showing first 15 of {parsed.rows.length} rows.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!validation.valid || committing}
            onClick={() => void handleCommit()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {committing ? "Importing..." : "Confirm import to database"}
          </button>
        </div>
      ) : null}

      {commitResult ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">Imported {commitResult.source}</p>
          <p className="mt-1">
            Created {commitResult.examSessions} sessions · Skipped {commitResult.skippedSessions}{" "}
            duplicates
          </p>
        </div>
      ) : null}
    </Card>
  );
}
