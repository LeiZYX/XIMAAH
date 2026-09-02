"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

interface ExamBoardOption {
  id: string;
  name: string;
  code: string;
}

interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

interface QualificationOption {
  id: string;
  name: string;
  level: string;
  code: string | null;
  subjects: SubjectOption[];
}

interface CashInCodeRow {
  id: string;
  cashInCode: string;
  active: boolean;
  notes: string | null;
  examBoard: ExamBoardOption;
  qualification: {
    id: string;
    name: string;
    level: string;
    code: string | null;
  };
  subject: SubjectOption;
}

interface ImportPreviewRow {
  rowNumber: number;
  action: "create" | "update";
  examBoardCode: string;
  qualificationLabel: string;
  subjectCode: string;
  subjectName: string;
  cashInCode: string;
  active: boolean;
}

interface ImportError {
  rowNumber: number;
  message: string;
}

export function CashInCodesManager({ basePath }: { basePath: "/admin" | "/exam-office" }) {
  const [boards, setBoards] = useState<ExamBoardOption[]>([]);
  const [examBoardId, setExamBoardId] = useState("");
  const [rows, setRows] = useState<CashInCodeRow[]>([]);
  const [qualifications, setQualifications] = useState<QualificationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [qualificationId, setQualificationId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [cashInCode, setCashInCode] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [importMeta, setImportMeta] = useState<{
    creates: number;
    updates: number;
    canCommit: boolean;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  const selectedQualification = useMemo(
    () => qualifications.find((item) => item.id === qualificationId) ?? null,
    [qualifications, qualificationId],
  );

  const loadRows = useCallback(async (boardId: string) => {
    if (!boardId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/cash-in-codes?examBoardId=${encodeURIComponent(boardId)}`,
      );
      const data = (await response.json()) as CashInCodeRow[] & { error?: string };
      if (!response.ok) throw new Error((data as { error?: string }).error ?? "Failed to load");
      setRows(data as CashInCodeRow[]);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Failed to load cash-in codes");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async (boardId: string) => {
    if (!boardId) {
      setQualifications([]);
      return;
    }
    const response = await fetch(
      `/api/cash-in-codes/options?examBoardId=${encodeURIComponent(boardId)}`,
    );
    if (!response.ok) return;
    setQualifications((await response.json()) as QualificationOption[]);
  }, []);

  useEffect(() => {
    void fetch("/api/exam-boards")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: ExamBoardOption[]) => {
        setBoards(data);
        if (data[0]?.id) setExamBoardId(data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!examBoardId) return;
    setQualificationId("");
    setSubjectId("");
    setImportPreview([]);
    setImportErrors([]);
    setImportMeta(null);
    void loadRows(examBoardId);
    void loadOptions(examBoardId);
  }, [examBoardId, loadOptions, loadRows]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!examBoardId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/cash-in-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examBoardId,
          qualificationId,
          subjectId,
          cashInCode,
          notes: notes || null,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to create");
      setCashInCode("");
      setNotes("");
      setMessage("Cash-in code created.");
      await loadRows(examBoardId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: CashInCodeRow) {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/cash-in-codes/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !row.active }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Failed to update");
      return;
    }
    await loadRows(examBoardId);
  }

  async function removeRow(row: CashInCodeRow) {
    if (!window.confirm(`Delete cash-in code ${row.cashInCode}?`)) return;
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/cash-in-codes/${row.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Failed to delete");
      return;
    }
    setMessage("Cash-in code deleted.");
    await loadRows(examBoardId);
  }

  async function previewImport() {
    if (!importFile) return;
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("file", importFile);
      form.set("commit", "false");
      const response = await fetch("/api/cash-in-codes/import", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        error?: string;
        preview?: ImportPreviewRow[];
        errors?: ImportError[];
        creates?: number;
        updates?: number;
        canCommit?: boolean;
      };
      if (!response.ok) throw new Error(data.error ?? "Failed to preview import");
      setImportPreview(data.preview ?? []);
      setImportErrors(data.errors ?? []);
      setImportMeta({
        creates: data.creates ?? 0,
        updates: data.updates ?? 0,
        canCommit: Boolean(data.canCommit),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview import");
    } finally {
      setImporting(false);
    }
  }

  async function commitImport() {
    if (!importFile || !importMeta?.canCommit) return;
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("file", importFile);
      form.set("commit", "true");
      const response = await fetch("/api/cash-in-codes/import", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        error?: string;
        created?: number;
        updated?: number;
      };
      if (!response.ok) throw new Error(data.error ?? "Failed to import");
      setMessage(
        `Import complete: ${data.created ?? 0} created, ${data.updated ?? 0} updated.`,
      );
      setImportFile(null);
      setImportPreview([]);
      setImportErrors([]);
      setImportMeta(null);
      await loadRows(examBoardId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setImporting(false);
    }
  }

  const templateHref = examBoardId
    ? `/api/cash-in-codes/template?examBoardId=${encodeURIComponent(examBoardId)}&includeExisting=true`
    : "/api/cash-in-codes/template";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash-in Codes"
        description="Maintain official cash-in entry codes by exam board, qualification, and subject. Download a template or upload bulk updates."
      />

      <Card className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Exam board</span>
          <select
            value={examBoardId}
            onChange={(event) => setExamBoardId(event.target.value)}
            className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2"
          >
            {boards.length === 0 ? <option value="">No exam boards</option> : null}
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name} ({board.code})
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-slate-600">
          Pricing for cash-in is configured in{" "}
          <a href={`${basePath}/fee-schedules`} className="text-indigo-700 hover:underline">
            Fee Schedule
          </a>{" "}
          (service type CASH_IN, preferably by exam series). Requests come later.{" "}
          <a href={`${basePath}/cash-in-requests`} className="text-indigo-700 hover:underline">
            Cash-in Requests
          </a>
        </p>
      </Card>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Template download / upload</h2>
            <p className="mt-1 text-sm text-slate-600">
              Download includes current codes for the selected board when available.
            </p>
          </div>
          <a
            href={templateHref}
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
          >
            Download template
          </a>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Excel file (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx"
              onChange={(event) => {
                setImportFile(event.target.files?.[0] ?? null);
                setImportPreview([]);
                setImportErrors([]);
                setImportMeta(null);
              }}
            />
          </label>
          <button
            type="button"
            disabled={!importFile || importing}
            onClick={() => void previewImport()}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {importing ? "Working…" : "Preview import"}
          </button>
          <button
            type="button"
            disabled={!importMeta?.canCommit || importing}
            onClick={() => void commitImport()}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Confirm import
          </button>
        </div>

        {importMeta ? (
          <p className="text-sm text-slate-700">
            Preview: {importMeta.creates} create(s), {importMeta.updates} update(s)
            {importErrors.length > 0 ? ` · ${importErrors.length} error(s)` : ""}
          </p>
        ) : null}

        {importErrors.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">Import errors</p>
            <ul className="mt-2 list-disc pl-5">
              {importErrors.slice(0, 20).map((item) => (
                <li key={`${item.rowNumber}-${item.message}`}>
                  Row {item.rowNumber}: {item.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {importPreview.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Row</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Board</th>
                  <th className="px-3 py-2 text-left">Qualification</th>
                  <th className="px-3 py-2 text-left">Subject</th>
                  <th className="px-3 py-2 text-left">Cash-in Code</th>
                  <th className="px-3 py-2 text-left">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {importPreview.map((row) => (
                  <tr key={`${row.rowNumber}-${row.cashInCode}`}>
                    <td className="px-3 py-2">{row.rowNumber}</td>
                    <td className="px-3 py-2">{row.action}</td>
                    <td className="px-3 py-2">{row.examBoardCode}</td>
                    <td className="px-3 py-2">{row.qualificationLabel}</td>
                    <td className="px-3 py-2">
                      {row.subjectCode} · {row.subjectName}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.cashInCode}</td>
                    <td className="px-3 py-2">{row.active ? "Y" : "N"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Add cash-in code</h2>
        <form onSubmit={(event) => void handleCreate(event)} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Qualification</span>
            <select
              required
              value={qualificationId}
              onChange={(event) => {
                setQualificationId(event.target.value);
                setSubjectId("");
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Select qualification</option>
              {qualifications.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.level}
                  {item.code ? ` · ${item.code}` : ""} — {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Subject</span>
            <select
              required
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              disabled={!selectedQualification}
            >
              <option value="">Select subject</option>
              {(selectedQualification?.subjects ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Cash-in code</span>
            <input
              required
              value={cashInCode}
              onChange={(event) => setCashInCode(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="XMA01"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Notes</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving || !examBoardId}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add code"}
            </button>
          </div>
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Codes for selected board ({rows.length})
        </h2>
        {loading ? <p className="text-sm text-slate-600">Loading…</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="text-sm text-slate-600">No cash-in codes yet for this board.</p>
        ) : null}
        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Qualification</th>
                  <th className="px-3 py-2 text-left">Subject</th>
                  <th className="px-3 py-2 text-left">Cash-in Code</th>
                  <th className="px-3 py-2 text-left">Active</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      {row.qualification.level}
                      {row.qualification.code ? ` · ${row.qualification.code}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      {row.subject.code} — {row.subject.name}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">{row.cashInCode}</td>
                    <td className="px-3 py-2">{row.active ? "Active" : "Inactive"}</td>
                    <td className="px-3 py-2 text-slate-600">{row.notes ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleActive(row)}
                          className="text-indigo-700 hover:underline"
                        >
                          {row.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeRow(row)}
                          className="text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
