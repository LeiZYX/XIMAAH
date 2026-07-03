"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CandidatesSubnav } from "@/components/candidates/CandidatesSubnav";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  candidateExamIdentityStatusLabel,
  formatRegisteredAt,
  type ExamBoardIdentityRow,
} from "@/lib/candidates/exam-board-identity.shared";
import type {
  ExamBoardIdentityImportPreviewItem,
  ExamBoardIdentityImportSummary,
} from "@/lib/candidates/exam-board-identity-import";
import {
  CANDIDATE_BOARD_REGISTRATION_MODULE_DESCRIPTION,
  CANDIDATE_BOARD_REGISTRATION_MODULE_TITLE,
  EXAM_BOARD_IDENTITIES_TAB,
} from "@/lib/navigation/candidate-board-registration";
import { LIST_PAGE_SIZES } from "@/lib/pagination";
import { ExcelFileDropzone, isXlsxFile } from "@/components/ui/ExcelFileDropzone";

interface ImportError {
  row: number;
  message: string;
  kind?: "validation" | "duplicate" | "header";
}

interface ImportPreviewState {
  preview: ExamBoardIdentityImportPreviewItem[];
  creates: ExamBoardIdentityImportPreviewItem[];
  updates: ExamBoardIdentityImportPreviewItem[];
  validationErrors: ImportError[];
  duplicates: ImportError[];
  total: number;
  studentsToCreate: number;
  studentsToUpdate: number;
  canCommit: boolean;
}

const buttonClass =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
const primaryButtonClass =
  "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50";

export function CandidateBoardRegistrationPanel({
  apiPath,
  detailBasePath,
  moduleBasePath,
}: {
  apiPath: string;
  detailBasePath: string;
  moduleBasePath: string;
}) {
  const [rows, setRows] = useState<ExamBoardIdentityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [q, setQ] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importCommitting, setImportCommitting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ExamBoardIdentityImportSummary | null>(null);

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    return `${apiPath}/board-registration/export?${params.toString()}`;
  }, [apiPath, q]);

  const templateHref = `${apiPath}/board-registration/import/template`;
  const importEndpoint = `${apiPath}/board-registration/import`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    try {
      const response = await fetch(`${apiPath}/board-registration?${params.toString()}`);
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load candidate board registrations");
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
      if (typeof data.page === "number") setPage(data.page);
    } catch (loadError) {
      setRows([]);
      setTotal(0);
      setTotalPages(0);
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load candidate board registrations",
      );
    } finally {
      setLoading(false);
    }
  }, [apiPath, page, pageSize, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const previewImport = useCallback(async (selectedFile: File) => {
    if (!isXlsxFile(selectedFile)) {
      setImportError("Only Excel (.xlsx) files are supported.");
      setImportPreview(null);
      return;
    }

    setImportLoading(true);
    setImportError(null);
    setImportMessage(null);
    setImportSummary(null);
    setImportPreview(null);

    const form = new FormData();
    form.append("file", selectedFile);

    try {
      const response = await fetch(importEndpoint, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Import preview failed");
      }

      setImportPreview({
        preview: Array.isArray(data.preview) ? data.preview : [],
        creates: Array.isArray(data.creates) ? data.creates : [],
        updates: Array.isArray(data.updates) ? data.updates : [],
        validationErrors: Array.isArray(data.errors) ? data.errors : [],
        duplicates: Array.isArray(data.duplicates) ? data.duplicates : [],
        total: typeof data.total === "number" ? data.total : 0,
        studentsToCreate: typeof data.studentsToCreate === "number" ? data.studentsToCreate : 0,
        studentsToUpdate: typeof data.studentsToUpdate === "number" ? data.studentsToUpdate : 0,
        canCommit: Boolean(data.canCommit),
      });
    } catch (previewError) {
      setImportError(previewError instanceof Error ? previewError.message : "Import preview failed");
      setImportPreview(null);
    } finally {
      setImportLoading(false);
    }
  }, [importEndpoint]);

  useEffect(() => {
    if (!file) {
      setImportPreview(null);
      return;
    }
    void previewImport(file);
  }, [file, previewImport]);

  async function commitImport() {
    if (!file) {
      setImportError("Choose an Excel (.xlsx) file first.");
      return;
    }
    if (!importPreview?.canCommit) {
      setImportError("Fix all validation errors and duplicate rows before committing.");
      return;
    }

    setImportCommitting(true);
    setImportError(null);
    setImportMessage(null);
    setImportSummary(null);

    const form = new FormData();
    form.append("file", file);
    form.append("commit", "true");

    try {
      const response = await fetch(importEndpoint, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Import failed");
      }

      setImportSummary({
        studentsCreated: typeof data.studentsCreated === "number" ? data.studentsCreated : 0,
        studentsUpdated: typeof data.studentsUpdated === "number" ? data.studentsUpdated : 0,
        identitiesCreated: typeof data.identitiesCreated === "number" ? data.identitiesCreated : 0,
        identitiesUpdated: typeof data.identitiesUpdated === "number" ? data.identitiesUpdated : 0,
        schoolNumbersUpdated: typeof data.schoolNumbersUpdated === "number" ? data.schoolNumbersUpdated : 0,
      });
      setImportMessage("Import completed successfully.");
      setImportPreview(null);
      setFile(null);
      void load();
    } catch (submitError) {
      setImportError(submitError instanceof Error ? submitError.message : "Import failed");
    } finally {
      setImportCommitting(false);
    }
  }

  const previewColumns: Array<keyof ExamBoardIdentityImportPreviewItem> = [
    "row",
    "studentAction",
    "action",
    "matchBy",
    "schoolStudentNumber",
    "systemStudentId",
    "englishName",
    "examBoard",
    "centreNumber",
    "candidateNumber",
    "uciNumber",
    "status",
  ];

  return (
    <div className="space-y-6">
      <CandidatesSubnav basePath={moduleBasePath} />
      <PageHeader
        title={CANDIDATE_BOARD_REGISTRATION_MODULE_TITLE}
        description={CANDIDATE_BOARD_REGISTRATION_MODULE_DESCRIPTION}
      />

      <Card className="space-y-3 border-slate-200 bg-slate-50 text-sm text-slate-700">
        <p className="font-medium text-slate-900">One student, multiple exam board identities</p>
        <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-slate-600">
{`Student
├── Pearson / Edexcel identity
├── AQA identity
└── Cambridge identity`}
        </pre>
        <p>
          Each row below is one board identity for one candidate. Subject and session registration is
          managed elsewhere.
        </p>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Import &amp; Export</h2>
          <p className="mt-1 text-sm text-slate-600">
            Download the Excel template, upload a .xlsx file, preview changes, then commit. Rows match
            candidates by School Student Number first, then Student ID when that column is present.
          </p>
        </div>

        <ol className="space-y-4 text-sm text-slate-700">
          <li className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-slate-900">1. Download Excel Template</span>
            <a href={templateHref} className={buttonClass}>
              Download Excel Template
            </a>
          </li>

          <li className="space-y-2">
            <span className="font-medium text-slate-900">2. Choose Excel File</span>
            <ExcelFileDropzone
              file={file}
              disabled={importLoading || importCommitting}
              onFileChange={(nextFile) => {
                setFile(nextFile);
                setImportMessage(null);
                setImportSummary(null);
                setImportError(null);
              }}
              onInvalidFile={setImportError}
            />
          </li>

          <li className="space-y-3">
            <span className="font-medium text-slate-900">3. Preview &amp; Commit</span>
            {file ? (
              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Preview Import</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => file && void previewImport(file)}
                      disabled={!file || importLoading || importCommitting}
                      className={buttonClass}
                    >
                      {importLoading ? "Previewing..." : "Refresh Preview"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void commitImport()}
                      disabled={!importPreview?.canCommit || importLoading || importCommitting}
                      className={primaryButtonClass}
                    >
                      {importCommitting ? "Committing..." : "Commit Import"}
                    </button>
                    <a href={exportHref} className={buttonClass}>
                      Export
                    </a>
                  </div>
                </div>

                {importLoading ? (
                  <p className="text-sm text-slate-400">Analyzing file...</p>
                ) : importPreview ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <PreviewStat label="Total rows" value={importPreview.total} />
                      <PreviewStat
                        label="New students"
                        value={importPreview.studentsToCreate}
                        tone="success"
                      />
                      <PreviewStat
                        label="Existing students to update"
                        value={importPreview.studentsToUpdate}
                        tone="info"
                      />
                      <PreviewStat
                        label="Validation errors"
                        value={importPreview.validationErrors.length}
                        tone={importPreview.validationErrors.length > 0 ? "danger" : "neutral"}
                      />
                      <PreviewStat
                        label="Duplicate rows"
                        value={importPreview.duplicates.length}
                        tone={importPreview.duplicates.length > 0 ? "danger" : "neutral"}
                      />
                    </div>

                    {!importPreview.canCommit ? (
                      <p className="text-sm text-amber-800">
                        Commit Import is disabled until all validation errors and duplicate rows are resolved.
                      </p>
                    ) : null}

                    {importPreview.validationErrors.length > 0 ? (
                      <ImportIssueTable title="Validation errors" rows={importPreview.validationErrors} />
                    ) : null}

                    {importPreview.duplicates.length > 0 ? (
                      <ImportIssueTable title="Duplicate rows" rows={importPreview.duplicates} />
                    ) : null}

                    {importPreview.preview.length > 0 ? (
                      <div className="overflow-x-auto">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Rows to import
                        </p>
                        <table className="min-w-full border-collapse border border-slate-200 bg-white text-sm">
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
                            {importPreview.preview.map((row) => (
                              <tr key={row.row}>
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
                  </>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Choose an Excel file to preview the import.</p>
            )}
          </li>
        </ol>

        {importSummary ? (
          <ImportSummaryCard summary={importSummary} />
        ) : null}
        {importMessage && !importSummary ? <p className="text-sm text-green-700">{importMessage}</p> : null}
        {importError ? <p className="text-sm text-red-700">{importError}</p> : null}
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <input
            placeholder="Search candidate, student ID, board number, or UCI"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            Search
          </button>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {loading && rows.length === 0 ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No board identities match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Candidate</th>
                  <th className="py-2 pr-3">Student ID</th>
                  <th className="py-2 pr-3">Exam board</th>
                  <th className="py-2 pr-3">Centre no.</th>
                  <th className="py-2 pr-3">Candidate no.</th>
                  <th className="py-2 pr-3">UCI</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Registered at</th>
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{row.candidateName}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.studentId ?? "—"}</td>
                    <td className="py-2 pr-3">{row.examBoardName}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.centreNumber ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.candidateNumber ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.uciNumber ?? "—"}</td>
                    <td className="py-2 pr-3">{candidateExamIdentityStatusLabel(row.status)}</td>
                    <td className="py-2 pr-3">{formatRegisteredAt(row.registeredAt)}</td>
                    <td className="max-w-[12rem] truncate py-2 pr-3" title={row.notes ?? undefined}>
                      {row.notes ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <Link
                        href={`${detailBasePath}/${row.candidateId}?tab=${EXAM_BOARD_IDENTITIES_TAB}`}
                        className="text-indigo-600 hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          loading={loading}
          itemLabel="board identities"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </Card>
    </div>
  );
}

function PreviewStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "info" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "info"
        ? "border-indigo-200 bg-indigo-50 text-indigo-900"
        : tone === "danger"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ImportSummaryCard({ summary }: { summary: ExamBoardIdentityImportSummary }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      <h3 className="font-semibold text-emerald-900">Import Summary</h3>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-emerald-800">New students created</dt>
          <dd className="text-lg font-semibold">{summary.studentsCreated}</dd>
        </div>
        <div>
          <dt className="text-emerald-800">Existing students updated</dt>
          <dd className="text-lg font-semibold">{summary.studentsUpdated}</dd>
        </div>
        <div>
          <dt className="text-emerald-800">New board identities created</dt>
          <dd className="text-lg font-semibold">{summary.identitiesCreated}</dd>
        </div>
        <div>
          <dt className="text-emerald-800">Board identities updated</dt>
          <dd className="text-lg font-semibold">{summary.identitiesUpdated}</dd>
        </div>
        {summary.schoolNumbersUpdated > 0 ? (
          <div className="sm:col-span-2">
            <dt className="text-emerald-800">School Student Numbers updated</dt>
            <dd className="text-lg font-semibold">{summary.schoolNumbersUpdated}</dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-3 text-xs text-emerald-800">
        Student IDs were generated automatically for new students. Existing Student IDs were left unchanged.
      </p>
    </div>
  );
}

function ImportIssueTable({ title, rows }: { title: string; rows: ImportError[] }) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-red-700">{title}</p>
      <table className="min-w-full border-collapse border border-red-200 bg-white text-sm">
        <thead>
          <tr className="bg-red-50 text-left text-xs uppercase text-red-700">
            <th className="border border-red-200 px-3 py-2">Row</th>
            <th className="border border-red-200 px-3 py-2">Issue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((rowError, index) => (
            <tr key={`${rowError.row}-${index}`}>
              <td className="border border-red-200 px-3 py-2">{rowError.row}</td>
              <td className="border border-red-200 px-3 py-2 text-red-700">{rowError.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
