"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { USERS_MODULE_DESCRIPTION } from "@/lib/navigation/module-descriptions";
import { GRADE_VALUES } from "@/lib/students/profile-enums";
import { UsersSubnav } from "@/components/users/UsersSubnav";

type ImportTab = "students" | "teachers";

interface ImportError {
  row: number;
  message: string;
}

interface ImportPreviewState {
  preview: Array<Record<string, unknown>>;
  creates: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
  skipped: Array<Record<string, unknown>>;
  errors: ImportError[];
  total: number;
}

const buttonClass =
  "rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
const primaryButtonClass =
  "rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";

function ImportTabPanel({
  kind,
  endpoint,
  exportHref,
  sampleHref,
}: {
  kind: ImportTab;
  endpoint: string;
  exportHref: string;
  sampleHref: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewState | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runImport(commit: boolean) {
    if (!file) {
      setError("Choose a file first.");
      return;
    }

    if (commit) setCommitting(true);
    else setLoading(true);
    setError(null);
    setMessage(null);

    const form = new FormData();
    form.append("file", file);
    if (commit) form.append("commit", "true");

    try {
      const response = await fetch(endpoint, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Import failed");
      }

      if (commit) {
        const created = typeof data.created === "number" ? data.created : 0;
        const updated = typeof data.updated === "number" ? data.updated : 0;
        const skipped = typeof data.skipped === "number" ? data.skipped : 0;
        setMessage(`Import complete: ${created} created, ${updated} updated, ${skipped} skipped.`);
        setPreview(null);
      } else {
        setPreview({
          preview: Array.isArray(data.preview) ? data.preview : [],
          creates: Array.isArray(data.creates) ? data.creates : [],
          updates: Array.isArray(data.updates) ? data.updates : [],
          skipped: Array.isArray(data.skipped) ? data.skipped : [],
          errors: Array.isArray(data.errors) ? data.errors : [],
          total: typeof data.total === "number" ? data.total : 0,
        });
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setLoading(false);
      setCommitting(false);
    }
  }

  const previewColumns =
    preview && preview.preview.length > 0 ? Object.keys(preview.preview[0] ?? {}) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setMessage(null);
            setError(null);
          }}
          className="text-sm text-slate-700"
        />
        <button
          type="button"
          onClick={() => void runImport(false)}
          disabled={!file || loading || committing}
          className={buttonClass}
        >
          {loading ? "Previewing..." : "Preview"}
        </button>
        <button
          type="button"
          onClick={() => void runImport(true)}
          disabled={!file || loading || committing || (preview?.errors.length ?? 0) > 0}
          className={primaryButtonClass}
        >
          {committing ? "Committing..." : "Commit import"}
        </button>
        <a href={sampleHref} className={buttonClass}>
          Download Excel Template
        </a>
        <a href={exportHref} className={buttonClass}>
          Export full list
        </a>
      </div>

      <p className="text-sm text-slate-600">
        Download the Excel template, fill in internal student profile fields, then upload for preview.
        Commit is enabled only when the preview has no validation errors.
      </p>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {preview ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            {preview.total} row{preview.total === 1 ? "" : "s"} parsed · {preview.creates.length}{" "}
            new · {preview.updates.length} update
            {preview.skipped.length > 0 ? ` · ${preview.skipped.length} skipped` : ""}
            {preview.errors.length > 0 ? ` · ${preview.errors.length} error(s)` : ""}
          </p>

          {preview.errors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-slate-200 text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                    <th className="border border-slate-200 px-3 py-2">Row</th>
                    <th className="border border-slate-200 px-3 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.map((rowError, index) => (
                    <tr key={`${rowError.row}-${index}`}>
                      <td className="border border-slate-200 px-3 py-2">{rowError.row}</td>
                      <td className="border border-slate-200 px-3 py-2 text-red-700">
                        {rowError.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {preview.preview.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-slate-200 text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                    {previewColumns.map((column) => (
                      <th key={column} className="border border-slate-200 px-3 py-2">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, index) => (
                    <tr key={index}>
                      {previewColumns.map((column) => (
                        <td key={column} className="border border-slate-200 px-3 py-2">
                          {String(row[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function UserImportExportPanel() {
  const [tab, setTab] = useState<ImportTab>("students");

  return (
    <div className="space-y-4">
      <UsersSubnav />
      <PageHeader
        title="Import / Export"
        description={`${USERS_MODULE_DESCRIPTION} Bulk import student and teacher identities from Excel, or export the full lists.`}
      />

      <div className="border border-slate-200">
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setTab("students")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "students"
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Students
          </button>
          <button
            type="button"
            onClick={() => setTab("teachers")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "teachers"
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Teachers
          </button>
        </div>

        <div className="p-4">
          {tab === "students" ? (
            <ImportTabPanel
              kind="students"
              endpoint="/api/admin/users/students"
              exportHref="/api/admin/users/students/export"
              sampleHref="/api/admin/users/students/import/template"
            />
          ) : (
            <ImportTabPanel
              kind="teachers"
              endpoint="/api/admin/users/teachers"
              exportHref="/api/admin/users/teachers/export"
              sampleHref="/api/admin/users/teachers/import/sample"
            />
          )}
        </div>
      </div>
    </div>
  );
}
