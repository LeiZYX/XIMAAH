"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import {
  FormField,
  SearchableSelectField,
  SelectField,
} from "@/components/admin/FormFields";
import { AdminStatus, fetchJsonList } from "@/components/admin/useAdminList";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { LIST_PAGE_SIZES } from "@/lib/pagination";

interface ExamBoard {
  id: string;
  name: string;
  code: string;
}

interface Qualification {
  id: string;
  name: string;
  level: string;
  code: string | null;
  examBoardId: string;
  examBoard?: ExamBoard;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  qualificationId?: string;
  qualification: {
    id: string;
    name: string;
    level: string;
    examBoardId?: string;
    examBoard: { id?: string; name?: string; code: string };
  };
}

interface Paper {
  id: string;
  code: string;
  title: string;
  duration: number | null;
  subject: Subject;
  _count?: { examSessions: number };
}

const emptyForm = {
  examBoardId: "",
  qualificationId: "",
  subjectId: "",
  code: "",
  title: "",
  duration: "",
};

export default function PapersPage() {
  const [items, setItems] = useState<Paper[]>([]);
  const [examBoards, setExamBoards] = useState<ExamBoard[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({
    examBoardId: "",
    qualificationId: "",
    subjectId: "",
    q: "",
  });

  const updateFilters = useCallback((patch: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const [boards, quals, subjectsList] = await Promise.all([
        fetchJsonList<ExamBoard>("/api/exam-boards"),
        fetchJsonList<Qualification>("/api/qualifications"),
        fetchJsonList<Subject>("/api/subjects"),
      ]);
      setExamBoards(boards);
      setQualifications(quals);
      setSubjects(subjectsList);
    } catch {
      setExamBoards([]);
      setQualifications([]);
      setSubjects([]);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filters.examBoardId) params.set("examBoardId", filters.examBoardId);
      if (filters.qualificationId) params.set("qualificationId", filters.qualificationId);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.q.trim()) params.set("q", filters.q.trim());

      const response = await fetch(`/api/papers?${params.toString()}`);
      const data = (await response.json()) as {
        papers?: Paper[];
        total?: number;
        page?: number;
        totalPages?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load papers");
      }
      setItems(Array.isArray(data.papers) ? data.papers : []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
      if (typeof data.page === "number") setPage(data.page);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setTotalPages(0);
      setLoadError(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const formQualifications = useMemo(
    () =>
      form.examBoardId
        ? qualifications.filter((item) => item.examBoardId === form.examBoardId)
        : [],
    [form.examBoardId, qualifications],
  );

  const formSubjects = useMemo(
    () =>
      form.qualificationId
        ? subjects.filter(
            (item) =>
              item.qualification.id === form.qualificationId ||
              item.qualificationId === form.qualificationId,
          )
        : [],
    [form.qualificationId, subjects],
  );

  const filterQualifications = useMemo(
    () =>
      filters.examBoardId
        ? qualifications.filter((item) => item.examBoardId === filters.examBoardId)
        : qualifications,
    [filters.examBoardId, qualifications],
  );

  const filterSubjects = useMemo(() => {
    if (filters.qualificationId) {
      return subjects.filter(
        (item) =>
          item.qualification.id === filters.qualificationId ||
          item.qualificationId === filters.qualificationId,
      );
    }
    if (filters.examBoardId) {
      return subjects.filter(
        (item) =>
          item.qualification.examBoardId === filters.examBoardId ||
          item.qualification.examBoard.id === filters.examBoardId,
      );
    }
    return subjects;
  }, [filters.examBoardId, filters.qualificationId, subjects]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.subjectId) return;

    const url = editingId ? `/api/papers/${editingId}` : "/api/papers";
    const method = editingId ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        title: form.title,
        duration: form.duration,
        subjectId: form.subjectId,
      }),
    });

    setForm(emptyForm);
    setEditingId(null);
    await loadItems();
  }

  function startEdit(item: Paper) {
    const boardId =
      item.subject.qualification.examBoard.id ??
      item.subject.qualification.examBoardId ??
      qualifications.find((q) => q.id === item.subject.qualification.id)?.examBoardId ??
      "";
    setEditingId(item.id);
    setForm({
      examBoardId: boardId,
      qualificationId: item.subject.qualification.id,
      subjectId: item.subject.id,
      code: item.code,
      title: item.title,
      duration: item.duration ? String(item.duration) : "",
    });
  }

  return (
    <div>
      <PageHeader
        title="Papers"
        description="Individual exam papers for each subject. Choose Board → Qualification → Subject, then add the paper."
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Edit Paper" : "Add Paper"}
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
                  qualificationId: "",
                  subjectId: "",
                }))
              }
              options={examBoards.map((board) => ({
                value: board.id,
                label: `${board.code} — ${board.name}`,
              }))}
              required
            />
            <SelectField
              label="Qualification"
              name="qualificationId"
              value={form.qualificationId}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  qualificationId: value,
                  subjectId: "",
                }))
              }
              options={formQualifications.map((qual) => ({
                value: qual.id,
                label: `${qual.level} · ${qual.name}${qual.code ? ` (${qual.code})` : ""}`,
              }))}
              placeholder={form.examBoardId ? "Select..." : "Select exam board first"}
              required
            />
            <SearchableSelectField
              label="Subject"
              name="subjectId"
              value={form.subjectId}
              onChange={(value) => setForm((current) => ({ ...current, subjectId: value }))}
              options={formSubjects.map((subject) => ({
                value: subject.id,
                label: `${subject.code} — ${subject.name}`,
              }))}
              placeholder={
                form.qualificationId ? "Search subject code or name…" : "Select qualification first"
              }
              searchHint="Fuzzy match on subject code / name"
              disabled={!form.qualificationId}
              emptyMessage={
                form.qualificationId
                  ? "No subjects match your search"
                  : "Select a qualification first"
              }
              required
            />
            <FormField
              label="Paper Code"
              name="code"
              value={form.code}
              onChange={(value) => setForm((current) => ({ ...current, code: value }))}
              required
              placeholder="8300/1F"
            />
            <FormField
              label="Title"
              name="title"
              value={form.title}
              onChange={(value) => setForm((current) => ({ ...current, title: value }))}
              required
            />
            <FormField
              label="Duration (minutes)"
              name="duration"
              type="number"
              value={form.duration}
              onChange={(value) => setForm((current) => ({ ...current, duration: value }))}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {editingId ? "Update" : "Create"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card className="space-y-0 overflow-x-auto p-0">
          <div className="space-y-3 border-b border-slate-100 p-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <select
                value={filters.examBoardId}
                onChange={(e) =>
                  updateFilters({
                    examBoardId: e.target.value,
                    qualificationId: "",
                    subjectId: "",
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All exam boards</option>
                {examBoards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.code} — {board.name}
                  </option>
                ))}
              </select>
              <select
                value={filters.qualificationId}
                onChange={(e) =>
                  updateFilters({
                    qualificationId: e.target.value,
                    subjectId: "",
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All qualifications</option>
                {filterQualifications.map((qual) => (
                  <option key={qual.id} value={qual.id}>
                    {qual.level} · {qual.name}
                  </option>
                ))}
              </select>
              <select
                value={filters.subjectId}
                onChange={(e) => updateFilters({ subjectId: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All subjects</option>
                {filterSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} — {subject.name}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={filters.q}
                onChange={(e) => updateFilters({ q: e.target.value })}
                placeholder="Search paper code / title…"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="p-4">
            <AdminStatus
              loading={loading}
              error={loadError}
              empty={!loading && !loadError && items.length === 0}
              entityName="papers"
            />
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Board</th>
                <th className="px-4 py-3 text-left">Qualification</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Duration</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-slate-700">
                    {item.subject.qualification.examBoard.code}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {item.subject.qualification.level} · {item.subject.qualification.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{item.subject.code}</span>
                    <span className="text-slate-600"> — {item.subject.name}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">{item.code}</td>
                  <td className="px-4 py-3">{item.title}</td>
                  <td className="px-4 py-3">
                    {item.duration ? `${item.duration} min` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="mr-2 text-sm text-indigo-600"
                    >
                      Edit
                    </button>
                    <DeleteButton
                      onDelete={async () => {
                        await fetch(`/api/papers/${item.id}`, { method: "DELETE" });
                        await loadItems();
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              loading={loading}
              itemLabel="papers"
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
