"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormField, SelectField } from "@/components/admin/FormFields";
import { AdminStatus, fetchJsonList } from "@/components/admin/useAdminList";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

interface Subject {
  id: string;
  name: string;
  code: string;
  qualification: {
    examBoard: { code: string };
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

const emptyForm = { code: "", title: "", duration: "", subjectId: "" };

export default function PapersPage() {
  const [items, setItems] = useState<Paper[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [papers, subjectsList] = await Promise.all([
        fetchJsonList<Paper>("/api/papers"),
        fetchJsonList<Subject>("/api/subjects"),
      ]);
      setItems(papers);
      setSubjects(subjectsList);
    } catch (error) {
      setItems([]);
      setSubjects([]);
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
    const url = editingId ? `/api/papers/${editingId}` : "/api/papers";
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
        title="Papers"
        description="Individual exam papers for each subject."
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Edit Paper" : "Add Paper"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <SelectField
              label="Subject"
              name="subjectId"
              value={form.subjectId}
              onChange={(value) => setForm((current) => ({ ...current, subjectId: value }))}
              options={subjects.map((subject) => ({
                value: subject.id,
                label: `${subject.qualification.examBoard.code} ${subject.code} — ${subject.name}`,
              }))}
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
              entityName="papers"
            />
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Duration</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium">{item.code}</td>
                  <td className="px-4 py-3">{item.title}</td>
                  <td className="px-4 py-3">{item.subject.name}</td>
                  <td className="px-4 py-3">
                    {item.duration ? `${item.duration} min` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          code: item.code,
                          title: item.title,
                          duration: item.duration ? String(item.duration) : "",
                          subjectId: item.subject.id,
                        });
                      }}
                      className="mr-2 text-sm text-indigo-600"
                    >
                      Edit
                    </button>
                    <DeleteButton
                      onDelete={async () => {
                        await fetch(`/api/papers/${item.id}`, { method: "DELETE" });
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
