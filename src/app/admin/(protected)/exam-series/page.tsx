"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormField, SelectField } from "@/components/admin/FormFields";
import { AdminStatus, fetchJsonList } from "@/components/admin/useAdminList";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

interface ExamBoard {
  id: string;
  name: string;
  code: string;
}

interface ExamSeries {
  id: string;
  name: string;
  year: number;
  startDate: string | null;
  endDate: string | null;
  examBoard: ExamBoard;
  _count?: { examSessions: number; keyDates: number };
}

const emptyForm = {
  name: "",
  year: String(new Date().getFullYear()),
  examBoardId: "",
  startDate: "",
  endDate: "",
};

export default function ExamSeriesPage() {
  const [items, setItems] = useState<ExamSeries[]>([]);
  const [examBoards, setExamBoards] = useState<ExamBoard[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [series, boards] = await Promise.all([
        fetchJsonList<ExamSeries>("/api/exam-series"),
        fetchJsonList<ExamBoard>("/api/exam-boards"),
      ]);
      setItems(series);
      setExamBoards(boards);
    } catch (error) {
      setItems([]);
      setExamBoards([]);
      setLoadError(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const url = editingId ? `/api/exam-series/${editingId}` : "/api/exam-series";
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

  return (
    <div>
      <PageHeader
        title="Exam Series"
        description="Exam windows such as Summer 2026 or November resits."
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Edit Exam Series" : "Add Exam Series"}
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
              placeholder="Summer 2026"
            />
            <FormField
              label="Year"
              name="year"
              type="number"
              value={form.year}
              onChange={(value) => setForm((current) => ({ ...current, year: value }))}
              required
            />
            <FormField
              label="Start Date"
              name="startDate"
              type="date"
              value={form.startDate}
              onChange={(value) => setForm((current) => ({ ...current, startDate: value }))}
            />
            <FormField
              label="End Date"
              name="endDate"
              type="date"
              value={form.endDate}
              onChange={(value) => setForm((current) => ({ ...current, endDate: value }))}
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
              entityName="exam series"
            />
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Board</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Year</th>
                <th className="px-4 py-3 text-left">Sessions</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.examBoard.code}</td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item.year}</td>
                  <td className="px-4 py-3">{item._count?.examSessions ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          name: item.name,
                          year: String(item.year),
                          examBoardId: item.examBoard.id,
                          startDate: item.startDate
                            ? item.startDate.split("T")[0]
                            : "",
                          endDate: item.endDate ? item.endDate.split("T")[0] : "",
                        });
                      }}
                      className="mr-2 text-sm text-indigo-600"
                    >
                      Edit
                    </button>
                    <DeleteButton
                      onDelete={async () => {
                        await fetch(`/api/exam-series/${item.id}`, { method: "DELETE" });
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
