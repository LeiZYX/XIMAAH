"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormField, SelectField } from "@/components/admin/FormFields";
import { AdminStatus, fetchJsonList } from "@/components/admin/useAdminList";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

interface Qualification {
  id: string;
  name: string;
  level: string;
  examBoard: { name: string; code: string };
}

interface Subject {
  id: string;
  name: string;
  code: string;
  qualification: Qualification & { id: string };
  _count?: { papers: number };
}

const emptyForm = { name: "", code: "", qualificationId: "" };

export default function SubjectsPage() {
  const [items, setItems] = useState<Subject[]>([]);
  const [qualifications, setQualifications] = useState<
    (Qualification & { id: string })[]
  >([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [subjects, qualifications] = await Promise.all([
        fetchJsonList<Subject>("/api/subjects"),
        fetchJsonList<Qualification>("/api/qualifications"),
      ]);
      setItems(subjects);
      setQualifications(qualifications);
    } catch (error) {
      setItems([]);
      setQualifications([]);
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
    const url = editingId ? `/api/subjects/${editingId}` : "/api/subjects";
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
        title="Subjects"
        description="Subjects linked to qualifications and exam boards."
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Edit Subject" : "Add Subject"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <SelectField
              label="Qualification"
              name="qualificationId"
              value={form.qualificationId}
              onChange={(value) =>
                setForm((current) => ({ ...current, qualificationId: value }))
              }
              options={qualifications.map((qual) => ({
                value: qual.id,
                label: `${qual.examBoard.code} ${qual.level} — ${qual.name}`,
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
              label="Code"
              name="code"
              value={form.code}
              onChange={(value) => setForm((current) => ({ ...current, code: value }))}
              required
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
              entityName="subjects"
            />
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Board</th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Papers</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.qualification.examBoard.code}</td>
                  <td className="px-4 py-3">{item.code}</td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item._count?.papers ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          name: item.name,
                          code: item.code,
                          qualificationId: item.qualification.id,
                        });
                      }}
                      className="mr-2 text-sm text-indigo-600"
                    >
                      Edit
                    </button>
                    <DeleteButton
                      onDelete={async () => {
                        await fetch(`/api/subjects/${item.id}`, { method: "DELETE" });
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
