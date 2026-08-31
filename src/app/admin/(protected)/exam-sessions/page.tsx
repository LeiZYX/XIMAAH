"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormField, SelectField, TextAreaField } from "@/components/admin/FormFields";
import { AdminStatus, fetchJsonList } from "@/components/admin/useAdminList";
import { ExcelFileDropzone } from "@/components/ui/ExcelFileDropzone";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

interface ExamBoard {
  id: string;
  name: string;
  code: string;
}

interface Paper {
  id: string;
  code: string;
  title: string;
  subject: {
    name: string;
    qualification: { examBoard: ExamBoard };
  };
}

interface ExamSeries {
  id: string;
  name: string;
  year: number;
  examBoard: ExamBoard;
}

interface ExamSession {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  notes: string | null;
  paper: Paper;
  examSeries: ExamSeries;
}

const emptyForm = {
  date: "",
  startTime: "",
  endTime: "",
  venue: "",
  notes: "",
  paperId: "",
  examSeriesId: "",
  examBoardId: "",
};

export default function ExamSessionsPage() {
  const [items, setItems] = useState<ExamSession[]>([]);
  const [examBoards, setExamBoards] = useState<ExamBoard[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [examSeries, setExamSeries] = useState<ExamSeries[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [sessions, papersList, seriesList, boards] = await Promise.all([
        fetchJsonList<ExamSession>("/api/exam-sessions"),
        fetchJsonList<Paper>("/api/papers"),
        fetchJsonList<ExamSeries>("/api/exam-series"),
        fetchJsonList<ExamBoard>("/api/exam-boards"),
      ]);
      setItems(sessions);
      setPapers(papersList);
      setExamSeries(seriesList);
      setExamBoards(boards);
    } catch (error) {
      setItems([]);
      setExamBoards([]);
      setPapers([]);
      setExamSeries([]);
      setLoadError(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const availablePapers = form.examBoardId
    ? papers.filter((paper) => paper.subject.qualification.examBoard.id === form.examBoardId)
    : [];
  const availableSeries = form.examBoardId
    ? examSeries.filter((series) => series.examBoard.id === form.examBoardId)
    : [];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const url = editingId ? `/api/exam-sessions/${editingId}` : "/api/exam-sessions";
    const method = editingId ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setForm(emptyForm);
    setEditingId(null);
    await load();
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importFile) {
      setImportError("Choose an Excel file first.");
      return;
    }

    setImporting(true);
    setImportMessage(null);
    setImportError(null);
    const formData = new FormData();
    formData.append("file", importFile);

    try {
      const response = await fetch("/api/exam-sessions/import", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        rowsParsed?: number;
        created?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Session import failed");
      }

      setImportMessage(
        `Processed ${data.rowsParsed ?? 0} row(s): ${data.created ?? 0} created, ${data.skipped ?? 0} skipped.`,
      );
      if (data.errors?.length) {
        setImportError(data.errors.slice(0, 5).join(" "));
      }
      await load();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Session import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Exam Sessions"
        description="Schedule when each paper is sat during an exam series."
      />
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Upload session Excel template</h2>
            <p className="mt-1 text-sm text-slate-600">
              Download the template, fill in the exam board, series, paper, date, and time for each
              session, then upload it here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/api/exam-sessions/import/template";
            }}
            className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Download Excel template
          </button>
        </div>
        <form onSubmit={handleImport} className="mt-4 space-y-4">
          <ExcelFileDropzone
            file={importFile}
            onFileChange={(file) => {
              setImportFile(file);
              setImportError(null);
              setImportMessage(null);
            }}
            onInvalidFile={setImportError}
            disabled={importing}
          />
          <button
            type="submit"
            disabled={importing || !importFile}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import exam sessions"}
          </button>
        </form>
        {importMessage ? (
          <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            {importMessage}
          </p>
        ) : null}
        {importError ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{importError}</p>
        ) : null}
      </Card>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Edit Exam Session" : "Add Exam Session"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <SelectField
              label="Exam Board"
              name="examBoardId"
              value={form.examBoardId}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  examBoardId: value,
                  paperId: "",
                  examSeriesId: "",
                }))
              }
              options={examBoards.map((board) => ({
                value: board.id,
                label: `${board.code} — ${board.name}`,
              }))}
              required
            />
            <SelectField
              label="Paper"
              name="paperId"
              value={form.paperId}
              onChange={(value) => setForm((current) => ({ ...current, paperId: value }))}
              options={availablePapers.map((paper) => ({
                value: paper.id,
                label: `${paper.code} — ${paper.title}`,
              }))}
              required
            />
            <SelectField
              label="Exam Series"
              name="examSeriesId"
              value={form.examSeriesId}
              onChange={(value) =>
                setForm((current) => ({ ...current, examSeriesId: value }))
              }
              options={availableSeries.map((series) => ({
                value: series.id,
                label: `${series.name} (${series.year})`,
              }))}
              required
            />
            <FormField
              label="Date"
              name="date"
              type="date"
              value={form.date}
              onChange={(value) => setForm((current) => ({ ...current, date: value }))}
              required
            />
            <FormField
              label="Start Time"
              name="startTime"
              type="time"
              value={form.startTime}
              onChange={(value) => setForm((current) => ({ ...current, startTime: value }))}
            />
            <FormField
              label="End Time"
              name="endTime"
              type="time"
              value={form.endTime}
              onChange={(value) => setForm((current) => ({ ...current, endTime: value }))}
            />
            <FormField
              label="Venue"
              name="venue"
              value={form.venue}
              onChange={(value) => setForm((current) => ({ ...current, venue: value }))}
            />
            <TextAreaField
              label="Notes"
              name="notes"
              value={form.notes}
              onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {editingId ? "Update" : "Create"}
            </button>
          </form>
        </Card>
        <Card className="overflow-x-auto p-0">
          <div className="p-4">
            <AdminStatus
              loading={loading}
              error={loadError}
              empty={!loading && !loadError && items.length === 0}
              entityName="exam sessions"
            />
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Exam Board</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Paper</th>
                <th className="px-4 py-3 text-left">Series</th>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Venue</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    {item.examSeries.examBoard.code} — {item.examSeries.examBoard.name}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(item.date).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3">{item.paper.code}</td>
                  <td className="px-4 py-3">{item.examSeries.name}</td>
                  <td className="px-4 py-3">
                    {item.startTime
                      ? `${item.startTime}${item.endTime ? `–${item.endTime}` : ""}`
                      : "All day"}
                  </td>
                  <td className="px-4 py-3">{item.venue ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          date: item.date.split("T")[0],
                          startTime: item.startTime ?? "",
                          endTime: item.endTime ?? "",
                          venue: item.venue ?? "",
                          notes: item.notes ?? "",
                          paperId: item.paper.id,
                          examSeriesId: item.examSeries.id,
                          examBoardId: item.examSeries.examBoard.id,
                        });
                      }}
                      className="mr-2 text-sm text-indigo-600"
                    >
                      Edit
                    </button>
                    <DeleteButton
                      onDelete={async () => {
                        await fetch(`/api/exam-sessions/${item.id}`, { method: "DELETE" });
                        await load();
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
