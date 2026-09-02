"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormField, SelectField } from "@/components/admin/FormFields";
import { AdminStatus, fetchJsonList } from "@/components/admin/useAdminList";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { LIST_PAGE_SIZES } from "@/lib/pagination";

interface Qualification {
  id: string;
  name: string;
  level: string;
  code: string | null;
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

function qualificationOptionLabel(qual: Qualification): string {
  const board = qual.examBoard.code;
  const level = qual.level.trim();
  // Post Phase-4: name usually equals level; avoid "Level — Level" noise.
  if (!qual.name || qual.name.trim() === level) {
    return `${board} · ${level}`;
  }
  return `${board} · ${level} — ${qual.name}`;
}

export default function SubjectsPage() {
  const [items, setItems] = useState<Subject[]>([]);
  const [qualifications, setQualifications] = useState<
    (Qualification & { id: string })[]
  >([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const qualificationOptions = useMemo(
    () =>
      [...qualifications]
        .sort(
          (a, b) =>
            a.examBoard.code.localeCompare(b.examBoard.code) ||
            a.level.localeCompare(b.level) ||
            a.name.localeCompare(b.name),
        )
        .map((qual) => ({
          value: qual.id,
          label: qualificationOptionLabel(qual),
        })),
    [qualifications],
  );

  const selectedQualificationMissing =
    Boolean(form.qualificationId) &&
    !qualifications.some((item) => item.id === form.qualificationId);

  const loadQualifications = useCallback(async () => {
    try {
      const qualificationsList = await fetchJsonList<Qualification & { id: string }>(
        "/api/qualifications",
      );
      setQualifications(qualificationsList);
    } catch {
      setQualifications([]);
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
      const response = await fetch(`/api/subjects?${params.toString()}`);
      const data = (await response.json()) as {
        subjects?: Subject[];
        total?: number;
        page?: number;
        totalPages?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load subjects");
      }
      setItems(Array.isArray(data.subjects) ? data.subjects : []);
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
    void loadQualifications();
  }, [loadQualifications]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

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
    await Promise.all([loadItems(), loadQualifications()]);
  }

  return (
    <div>
      <PageHeader
        title="Subjects"
        description="Subjects hang under level-based qualifications (board + level). After timetable import / Phase 4 merge, pick the matching board level — not a per-syllabus qualification."
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Edit Subject" : "Add Subject"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <SelectField
              label="Qualification (board · level)"
              name="qualificationId"
              value={form.qualificationId}
              onChange={(value) =>
                setForm((current) => ({ ...current, qualificationId: value }))
              }
              options={qualificationOptions}
              required
            />
            {selectedQualificationMissing ? (
              <p className="text-xs text-amber-700">
                Current qualification is missing from the list. Re-select a board · level
                qualification before saving.
              </p>
            ) : null}
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
                <th className="px-4 py-3 text-left">Level</th>
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
                  <td className="px-4 py-3">{item.qualification.level}</td>
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
              itemLabel="subjects"
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
