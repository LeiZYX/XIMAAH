"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormField, SelectField, TextAreaField } from "@/components/admin/FormFields";
import { AdminStatus, fetchJsonList } from "@/components/admin/useAdminList";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

const KEY_DATE_TYPES = [
  { value: "DEADLINE", label: "Deadline" },
  { value: "RESULTS", label: "Results" },
  { value: "REGISTRATION", label: "Registration" },
  { value: "OTHER", label: "Other" },
];

interface KeyDate {
  id: string;
  title: string;
  date: string;
  type: string;
  description: string | null;
  examBoard: { id: string; code: string } | null;
  subject: { id: string; name: string } | null;
  examSeries: { id: string; name: string } | null;
}

const emptyForm = {
  title: "",
  date: "",
  type: "OTHER",
  description: "",
  examBoardId: "",
  subjectId: "",
  examSeriesId: "",
};

export default function KeyDatesPage() {
  const [items, setItems] = useState<KeyDate[]>([]);
  const [examBoards, setExamBoards] = useState<{ id: string; code: string; name: string }[]>(
    [],
  );
  const [subjects, setSubjects] = useState<{ id: string; code: string; name: string }[]>([]);
  const [examSeries, setExamSeries] = useState<{ id: string; name: string; year: number }[]>(
    [],
  );
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [dates, boards, subjectsList, seriesList] = await Promise.all([
        fetchJsonList<KeyDate>("/api/key-dates"),
        fetchJsonList<{ id: string; code: string; name: string }>("/api/exam-boards"),
        fetchJsonList<{ id: string; code: string; name: string }>("/api/subjects"),
        fetchJsonList<{ id: string; name: string; year: number }>("/api/exam-series"),
      ]);
      setItems(dates);
      setExamBoards(boards);
      setSubjects(subjectsList);
      setExamSeries(seriesList);
    } catch (error) {
      setItems([]);
      setExamBoards([]);
      setSubjects([]);
      setExamSeries([]);
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
    const url = editingId ? `/api/key-dates/${editingId}` : "/api/key-dates";
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
        title="Key Dates"
        description="Deadlines, results days, and other important assessment dates."
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Edit Key Date" : "Add Key Date"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              label="Title"
              name="title"
              value={form.title}
              onChange={(value) => setForm((current) => ({ ...current, title: value }))}
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
            <SelectField
              label="Type"
              name="type"
              value={form.type}
              onChange={(value) => setForm((current) => ({ ...current, type: value }))}
              options={KEY_DATE_TYPES}
            />
            <SelectField
              label="Exam Board (optional)"
              name="examBoardId"
              value={form.examBoardId}
              onChange={(value) => setForm((current) => ({ ...current, examBoardId: value }))}
              options={examBoards.map((board) => ({
                value: board.id,
                label: `${board.code} — ${board.name}`,
              }))}
            />
            <SelectField
              label="Subject (optional)"
              name="subjectId"
              value={form.subjectId}
              onChange={(value) => setForm((current) => ({ ...current, subjectId: value }))}
              options={subjects.map((subject) => ({
                value: subject.id,
                label: `${subject.code} — ${subject.name}`,
              }))}
            />
            <SelectField
              label="Exam Series (optional)"
              name="examSeriesId"
              value={form.examSeriesId}
              onChange={(value) =>
                setForm((current) => ({ ...current, examSeriesId: value }))
              }
              options={examSeries.map((series) => ({
                value: series.id,
                label: `${series.name} (${series.year})`,
              }))}
            />
            <TextAreaField
              label="Description"
              name="description"
              value={form.description}
              onChange={(value) =>
                setForm((current) => ({ ...current, description: value }))
              }
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
              entityName="key dates"
            />
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Board</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    {new Date(item.date).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3">{item.title}</td>
                  <td className="px-4 py-3 capitalize">{item.type.toLowerCase()}</td>
                  <td className="px-4 py-3">{item.examBoard?.code ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          title: item.title,
                          date: item.date.split("T")[0],
                          type: item.type,
                          description: item.description ?? "",
                          examBoardId: item.examBoard?.id ?? "",
                          subjectId: item.subject?.id ?? "",
                          examSeriesId: item.examSeries?.id ?? "",
                        });
                      }}
                      className="mr-2 text-sm text-indigo-600"
                    >
                      Edit
                    </button>
                    <DeleteButton
                      onDelete={async () => {
                        await fetch(`/api/key-dates/${item.id}`, { method: "DELETE" });
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
