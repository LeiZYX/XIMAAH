"use client";

import { FormEvent, useState } from "react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormField, TextAreaField } from "@/components/admin/FormFields";
import { AdminStatus, useAdminList } from "@/components/admin/useAdminList";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { emptyExamBoardCentreForm } from "@/lib/exam-boards/form";

interface ExamBoard {
  id: string;
  name: string;
  code: string;
  country: string;
  region: string | null;
  description: string | null;
  centreName: string | null;
  centreNumber: string | null;
  centreAddress: string | null;
  centreEmail: string | null;
  centrePhone: string | null;
  centreCountry: string | null;
  centreTimeZone: string | null;
  defaultExamOfficerName: string | null;
  defaultExamOfficerEmail: string | null;
  _count?: { qualifications: number; examSeries: number };
}

const emptyBoardForm = {
  name: "",
  code: "",
  country: "",
  region: "",
  description: "",
  ...emptyExamBoardCentreForm,
};

export function ExamBoardsManager({
  canDelete = true,
  description = "Manage awarding bodies such as AQA, Edexcel, and Cambridge. Configure board-specific centre details used on exam documents.",
}: {
  canDelete?: boolean;
  description?: string;
}) {
  const { items, loading, error: loadError, reload: load } = useAdminList<ExamBoard>(
    "/api/exam-boards",
  );
  const [form, setForm] = useState(emptyBoardForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  function updateForm(patch: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...patch }));
  }

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

    setForm(emptyBoardForm);
    setEditingId(null);
    await load();
  }

  function startEdit(item: ExamBoard) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      code: item.code,
      country: item.country,
      region: item.region ?? "",
      description: item.description ?? "",
      centreName: item.centreName ?? "",
      centreNumber: item.centreNumber ?? "",
      centreAddress: item.centreAddress ?? "",
      centreEmail: item.centreEmail ?? "",
      centrePhone: item.centrePhone ?? "",
      centreCountry: item.centreCountry ?? "",
      centreTimeZone: item.centreTimeZone ?? "",
      defaultExamOfficerName: item.defaultExamOfficerName ?? "",
      defaultExamOfficerEmail: item.defaultExamOfficerEmail ?? "",
    });
  }

  return (
    <div>
      <PageHeader title="Exam Boards" description={description} />

      {!loading && items.length > 0 ? (
        <p className="mb-4 text-sm text-slate-600">
          Existing codes: {items.map((item) => item.code).join(", ")}. Each board can have its own
          centre number (e.g. Pearson Edexcel, Cambridge, AQA, OxfordAQA).
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Edit Exam Board" : "Add Exam Board"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Board details</h3>
              <FormField
                label="Name"
                name="name"
                value={form.name}
                onChange={(value) => updateForm({ name: value })}
                required
              />
              <FormField
                label="Code"
                name="code"
                value={form.code}
                onChange={(value) => updateForm({ code: value })}
                required
                placeholder="AQA"
              />
              <FormField
                label="Country (ISO code)"
                name="country"
                value={form.country}
                onChange={(value) => updateForm({ country: value })}
                required
                placeholder="GB"
              />
              <FormField
                label="Region"
                name="region"
                value={form.region}
                onChange={(value) => updateForm({ region: value })}
                placeholder="United Kingdom"
              />
              <TextAreaField
                label="Description"
                name="description"
                value={form.description}
                onChange={(value) => updateForm({ description: value })}
              />
            </div>

            <div className="space-y-4 border-t border-slate-200 pt-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Centre settings</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Board-specific centre details printed on exam documents and fee documents.
                </p>
              </div>
              <FormField
                label="Centre name"
                name="centreName"
                value={form.centreName}
                onChange={(value) => updateForm({ centreName: value })}
              />
              <FormField
                label="Centre number"
                name="centreNumber"
                value={form.centreNumber}
                onChange={(value) => updateForm({ centreNumber: value })}
                placeholder="Board-specific centre no."
              />
              <TextAreaField
                label="Centre address"
                name="centreAddress"
                value={form.centreAddress}
                onChange={(value) => updateForm({ centreAddress: value })}
              />
              <FormField
                label="Centre email"
                name="centreEmail"
                type="email"
                value={form.centreEmail}
                onChange={(value) => updateForm({ centreEmail: value })}
              />
              <FormField
                label="Centre phone"
                name="centrePhone"
                value={form.centrePhone}
                onChange={(value) => updateForm({ centrePhone: value })}
              />
              <FormField
                label="Centre country"
                name="centreCountry"
                value={form.centreCountry}
                onChange={(value) => updateForm({ centreCountry: value })}
                placeholder="CN"
              />
              <FormField
                label="Centre time zone"
                name="centreTimeZone"
                value={form.centreTimeZone}
                onChange={(value) => updateForm({ centreTimeZone: value })}
                placeholder="Asia/Shanghai"
              />
              <FormField
                label="Default exam officer name"
                name="defaultExamOfficerName"
                value={form.defaultExamOfficerName}
                onChange={(value) => updateForm({ defaultExamOfficerName: value })}
              />
              <FormField
                label="Default exam officer email"
                name="defaultExamOfficerEmail"
                type="email"
                value={form.defaultExamOfficerEmail}
                onChange={(value) => updateForm({ defaultExamOfficerEmail: value })}
              />
            </div>

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
                    setForm(emptyBoardForm);
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
                <th className="px-4 py-3 text-left font-medium text-slate-600">Centre no.</th>
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
                  <td className="px-4 py-3 font-mono text-xs">{item.centreNumber ?? "—"}</td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item._count?.qualifications ?? 0}</td>
                  <td className="px-4 py-3">{item._count?.examSeries ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="mr-2 rounded-md px-2 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                    >
                      Edit
                    </button>
                    {canDelete ? (
                      <DeleteButton
                        onDelete={async () => {
                          await fetch(`/api/exam-boards/${item.id}`, { method: "DELETE" });
                          await load();
                        }}
                      />
                    ) : null}
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
