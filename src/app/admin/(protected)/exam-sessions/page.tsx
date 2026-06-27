"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormField, SelectField, TextAreaField } from "@/components/admin/FormFields";
import { AdminStatus, fetchJsonList } from "@/components/admin/useAdminList";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

interface Paper {
  id: string;
  code: string;
  title: string;
  subject: { name: string };
}

interface ExamSeries {
  id: string;
  name: string;
  year: number;
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
};

export default function ExamSessionsPage() {
  const [items, setItems] = useState<ExamSession[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [examSeries, setExamSeries] = useState<ExamSeries[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [sessions, papersList, seriesList] = await Promise.all([
        fetchJsonList<ExamSession>("/api/exam-sessions"),
        fetchJsonList<Paper>("/api/papers"),
        fetchJsonList<ExamSeries>("/api/exam-series"),
      ]);
      setItems(sessions);
      setPapers(papersList);
      setExamSeries(seriesList);
    } catch (error) {
      setItems([]);
      setPapers([]);
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

  return (
    <div>
      <PageHeader
        title="Exam Sessions"
        description="Schedule when each paper is sat during an exam series."
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Edit Exam Session" : "Add Exam Session"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <SelectField
              label="Paper"
              name="paperId"
              value={form.paperId}
              onChange={(value) => setForm((current) => ({ ...current, paperId: value }))}
              options={papers.map((paper) => ({
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
              options={examSeries.map((series) => ({
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
