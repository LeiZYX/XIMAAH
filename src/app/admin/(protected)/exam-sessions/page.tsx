"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormField, SearchableSelectField, SelectField, TextAreaField } from "@/components/admin/FormFields";
import { AdminStatus, fetchJsonList } from "@/components/admin/useAdminList";
import { ExcelFileDropzone } from "@/components/ui/ExcelFileDropzone";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { LIST_PAGE_SIZES } from "@/lib/pagination";

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({
    examBoardId: "",
    examSeriesId: "",
    paperId: "",
    paperQ: "",
  });

  const updateFilters = useCallback((patch: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  const loadOptions = useCallback(async () => {
    const [papersList, seriesList, boards] = await Promise.all([
      fetchJsonList<Paper>("/api/papers"),
      fetchJsonList<ExamSeries>("/api/exam-series"),
      fetchJsonList<ExamBoard>("/api/exam-boards"),
    ]);
    setPapers(papersList);
    setExamSeries(seriesList);
    setExamBoards(boards);
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filters.examBoardId) params.set("examBoardId", filters.examBoardId);
      if (filters.examSeriesId) params.set("examSeriesId", filters.examSeriesId);
      if (filters.paperId) params.set("paperId", filters.paperId);
      if (filters.paperQ.trim()) params.set("paperQ", filters.paperQ.trim());

      const response = await fetch(`/api/exam-sessions?${params.toString()}`);
      const data = (await response.json()) as {
        sessions?: ExamSession[];
        total?: number;
        page?: number;
        totalPages?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load exam sessions");
      }

      setItems(Array.isArray(data.sessions) ? data.sessions : []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
      if (typeof data.page === "number") setPage(data.page);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setTotalPages(0);
      setLoadError(error instanceof Error ? error.message : "Failed to load exam sessions");
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOptions().catch(() => {
        setLoadError("Failed to load form options");
      });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadOptions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadSessions(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadSessions]);

  const availablePapers = form.examBoardId
    ? papers.filter((paper) => paper.subject.qualification.examBoard.id === form.examBoardId)
    : [];
  const availableSeries = form.examBoardId
    ? examSeries.filter((series) => series.examBoard.id === form.examBoardId)
    : [];

  const filterPapers = useMemo(() => {
    const boardId = filters.examBoardId;
    return boardId
      ? papers.filter((paper) => paper.subject.qualification.examBoard.id === boardId)
      : papers;
  }, [filters.examBoardId, papers]);

  const filterSeries = useMemo(() => {
    const boardId = filters.examBoardId;
    return boardId ? examSeries.filter((series) => series.examBoard.id === boardId) : examSeries;
  }, [examSeries, filters.examBoardId]);

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.examBoardId) params.set("examBoardId", filters.examBoardId);
    if (filters.examSeriesId) params.set("examSeriesId", filters.examSeriesId);
    if (filters.paperId) params.set("paperId", filters.paperId);
    if (filters.paperQ.trim()) params.set("paperQ", filters.paperQ.trim());
    const query = params.toString();
    return query ? `/api/exam-sessions/export?${query}` : "/api/exam-sessions/export";
  }, [filters]);

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
    await loadSessions();
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
      await loadSessions();
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
            <SearchableSelectField
              label="Paper"
              name="paperId"
              value={form.paperId}
              onChange={(value) => setForm((current) => ({ ...current, paperId: value }))}
              options={availablePapers.map((paper) => ({
                value: paper.id,
                label: `${paper.code} — ${paper.title} · ${paper.subject.name}`,
              }))}
              placeholder={
                form.examBoardId ? "Search paper code or title…" : "Select exam board first"
              }
              searchHint="Fuzzy match on paper code / title"
              disabled={!form.examBoardId}
              emptyMessage={
                form.examBoardId ? "No papers match your search" : "Select an exam board first"
              }
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
        <Card className="space-y-4 overflow-x-auto p-0">
          <div className="space-y-3 border-b border-slate-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Session list</h2>
              <button
                type="button"
                onClick={() => {
                  window.location.href = exportHref;
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Export Excel
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <select
                value={filters.examBoardId}
                onChange={(e) =>
                  updateFilters({
                    examBoardId: e.target.value,
                    examSeriesId: "",
                    paperId: "",
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                aria-label="Filter by exam board"
              >
                <option value="">All exam boards</option>
                {examBoards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.code} — {board.name}
                  </option>
                ))}
              </select>
              <select
                value={filters.examSeriesId}
                onChange={(e) => updateFilters({ examSeriesId: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                aria-label="Filter by exam series"
              >
                <option value="">All series</option>
                {filterSeries.map((series) => (
                  <option key={series.id} value={series.id}>
                    {series.examBoard.code} · {series.name} ({series.year})
                  </option>
                ))}
              </select>
              <select
                value={filters.paperId}
                onChange={(e) => updateFilters({ paperId: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                aria-label="Filter by paper"
              >
                <option value="">All papers</option>
                {filterPapers.map((paper) => (
                  <option key={paper.id} value={paper.id}>
                    {paper.code} — {paper.title}
                  </option>
                ))}
              </select>
              <input
                value={filters.paperQ}
                onChange={(e) => updateFilters({ paperQ: e.target.value })}
                placeholder="Search paper code / title"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                aria-label="Fuzzy search paper"
              />
            </div>
            <AdminStatus
              loading={loading}
              error={loadError}
              empty={!loading && !loadError && items.length === 0}
              entityName="exam sessions"
            />
          </div>
          <div className="overflow-x-auto">
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
                          await loadSessions();
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              loading={loading}
              itemLabel="exam sessions"
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
