"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormField, SelectField } from "@/components/admin/FormFields";
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
  examBoard: ExamBoard;
  _count?: { subjects: number };
}

const emptyForm = { name: "", level: "", code: "", examBoardId: "" };

export default function QualificationsPage() {
  const [items, setItems] = useState<Qualification[]>([]);
  const [examBoards, setExamBoards] = useState<ExamBoard[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const loadBoards = useCallback(async () => {
    try {
      const boards = await fetchJsonList<ExamBoard>("/api/exam-boards");
      setExamBoards(boards);
    } catch {
      setExamBoards([]);
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
      const response = await fetch(`/api/qualifications?${params.toString()}`);
      const data = (await response.json()) as {
        qualifications?: Qualification[];
        total?: number;
        page?: number;
        totalPages?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load qualifications");
      }
      setItems(Array.isArray(data.qualifications) ? data.qualifications : []);
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
  }, [page, pageSize]);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const url = editingId
      ? `/api/qualifications/${editingId}`
      : "/api/qualifications";
    const method = editingId ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setForm(emptyForm);
    setEditingId(null);
    await loadItems();
  }

  return (
    <div>
      <PageHeader
        title="Qualifications"
        description="Metadata for exam levels (GCSE, A Level, IAL, etc.). Day-to-day operations use Subjects; qualification is derived from the subject. Prefer Subjects admin and timetable import over creating per-syllabus qualifications here."
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Edit Qualification" : "Add Qualification"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <SelectField
              label="Exam Board"
              name="examBoardId"
              value={form.examBoardId}
              onChange={(value) => setForm((current) => ({ ...current, examBoardId: value }))}
              options={examBoards.map((board) => ({
                value: board.id,
                label: `${board.code} — ${board.name}`,
              }))}
              required
            />
            <FormField
              label="Name"
              name="name"
              value={form.name}
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              required
            />
            <FormField
              label="Level"
              name="level"
              value={form.level}
              onChange={(value) => setForm((current) => ({ ...current, level: value }))}
              required
              placeholder="GCSE"
            />
            <FormField
              label="Code"
              name="code"
              value={form.code}
              onChange={(value) => setForm((current) => ({ ...current, code: value }))}
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
              entityName="qualifications"
            />
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Board</th>
                <th className="px-4 py-3 text-left">Level</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Subjects</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.examBoard.code}</td>
                  <td className="px-4 py-3">{item.level}</td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item._count?.subjects ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          name: item.name,
                          level: item.level,
                          code: item.code ?? "",
                          examBoardId: item.examBoard.id,
                        });
                      }}
                      className="mr-2 text-sm text-indigo-600"
                    >
                      Edit
                    </button>
                    <DeleteButton
                      onDelete={async () => {
                        await fetch(`/api/qualifications/${item.id}`, { method: "DELETE" });
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
              itemLabel="qualifications"
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
