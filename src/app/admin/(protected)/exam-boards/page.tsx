"use client";

import { FormEvent, useState } from "react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormField, TextAreaField } from "@/components/admin/FormFields";
import { AdminStatus, useAdminList } from "@/components/admin/useAdminList";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

interface ExamBoard {
  id: string;
  name: string;
  code: string;
  country: string;
  region: string | null;
  description: string | null;
  _count?: { qualifications: number; examSeries: number };
}

const emptyForm = { name: "", code: "", country: "", region: "", description: "" };

export default function ExamBoardsPage() {
  const { items, loading, error: loadError, reload: load } = useAdminList<ExamBoard>(
    "/api/exam-boards",
  );
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");

    const url = editingId ? `/api/exam-boards/${editingId}` : "/api/exam-boards";
    const method = editingId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const data = await response.json();
      setFormError(data.error || "Failed to save exam board");
      return;
    }

    setForm(emptyForm);
    setEditingId(null);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Exam Boards"
        description="Manage awarding bodies such as AQA, Edexcel, and OCR. Each board needs a unique code."
      />

      {!loading && items.length > 0 ? (
        <p className="mb-4 text-sm text-slate-600">
          Existing codes: {items.map((item) => item.code).join(", ")}. Run{" "}
          <code className="rounded bg-slate-100 px-1">npm run db:seed</code> to pre-load AQA,
          CIE, and EDEXCEL.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Edit Exam Board" : "Add Exam Board"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="AQA"
            />
            <FormField
              label="Country (ISO code)"
              name="country"
              value={form.country}
              onChange={(value) => setForm((current) => ({ ...current, country: value }))}
              required
              placeholder="GB"
            />
            <FormField
              label="Region"
              name="region"
              value={form.region}
              onChange={(value) => setForm((current) => ({ ...current, region: value }))}
              placeholder="United Kingdom"
            />
            <TextAreaField
              label="Description"
              name="description"
              value={form.description}
              onChange={(value) =>
                setForm((current) => ({ ...current, description: value }))
              }
            />
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <div className="flex gap-2">
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
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card className="overflow-x-auto p-0">
          <div className="p-4">
            <AdminStatus
              loading={loading}
              error={loadError}
              empty={!loading && !loadError && items.length === 0}
              entityName="exam boards"
            />
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Code</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Country</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Qualifications</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Series</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium">{item.code}</td>
                  <td className="px-4 py-3">{item.country}</td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item._count?.qualifications ?? 0}</td>
                  <td className="px-4 py-3">{item._count?.examSeries ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          name: item.name,
                          code: item.code,
                          country: item.country,
                          region: item.region ?? "",
                          description: item.description ?? "",
                        });
                      }}
                      className="mr-2 rounded-md px-2 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                    >
                      Edit
                    </button>
                    <DeleteButton
                      onDelete={async () => {
                        await fetch(`/api/exam-boards/${item.id}`, { method: "DELETE" });
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
