"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { dateInputValueToIso } from "@/lib/datetime-local";
import type { FeeScheduleServiceType } from "@/generated/prisma";

interface ScheduleRow {
  id: string;
  serviceType: FeeScheduleServiceType;
  version: number;
  status: string;
  effectiveFrom: string;
  costAmount: string;
  costCurrency: string;
  salesAmount: string;
  salesCurrency: string;
  examBoard?: { name: string; code: string };
  examSeries?: { id: string; name: string; year: number } | null;
  qualification?: { id: string; name: string; level: string; code: string | null } | null;
  subject?: { id: string; name: string; code: string } | null;
}

interface ExamBoardOption {
  id: string;
  name: string;
  code?: string;
}

interface ExamSeriesOption {
  id: string;
  name: string;
  year: number;
}

interface SubjectOption {
  id: string;
  name: string;
  code: string;
  qualificationId?: string;
  level?: string;
  qualificationCode?: string | null;
}

const SERVICE_TYPES: FeeScheduleServiceType[] = [
  "CANDIDATE_REGISTRATION",
  "EXAM_ENTRY",
  "REVIEW",
  "PRIORITY_REVIEW",
  "CLERICAL_CHECK",
  "ACCESS_TO_SCRIPT",
  "CASH_IN",
  "CERTIFICATE",
  "ADMINISTRATIVE",
];

export function FeeScheduleManager({ basePath = "/admin" }: { basePath?: "/admin" | "/exam-office" }) {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [boards, setBoards] = useState<ExamBoardOption[]>([]);
  const [series, setSeries] = useState<ExamSeriesOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [examBoardId, setExamBoardId] = useState("");
  const [serviceType, setServiceType] = useState<FeeScheduleServiceType>("EXAM_ENTRY");
  const [examSeriesId, setExamSeriesId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [costCurrency, setCostCurrency] = useState<"GBP" | "CNY">("GBP");
  const [costAmount, setCostAmount] = useState("");
  const [salesCurrency, setSalesCurrency] = useState<"GBP" | "CNY">("GBP");
  const [salesAmount, setSalesAmount] = useState("");

  const isCashIn = serviceType === "CASH_IN";

  const filteredSubjects = useMemo(() => {
    const q = subjectFilter.trim().toLowerCase();
    const list = !q
      ? subjects
      : subjects.filter(
          (item) =>
            item.code.toLowerCase().includes(q) ||
            item.name.toLowerCase().includes(q) ||
            (item.level ?? "").toLowerCase().includes(q) ||
            (item.qualificationCode ?? "").toLowerCase().includes(q),
        );
    if (subjectId && !list.some((item) => item.id === subjectId)) {
      const selected = subjects.find((item) => item.id === subjectId);
      if (selected) return [selected, ...list];
    }
    return list;
  }, [subjects, subjectFilter, subjectId]);

  async function loadSchedules() {
    setLoading(true);
    const response = await fetch("/api/fee-schedules");
    if (response.ok) setSchedules(await response.json());
    setLoading(false);
  }

  useEffect(() => {
    void loadSchedules();
    void fetch("/api/exam-boards")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ExamBoardOption[]) => setBoards(data));
  }, []);

  useEffect(() => {
    setExamSeriesId("");
    setSubjectId("");
    setSubjectFilter("");
    setSeries([]);
    setSubjects([]);
    if (!examBoardId) return;

    void fetch(`/api/exam-series?examBoardId=${encodeURIComponent(examBoardId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ExamSeriesOption[]) => setSeries(data));

    if (isCashIn) {
      void fetch(`/api/cash-in-codes/options?examBoardId=${encodeURIComponent(examBoardId)}`)
        .then((r) => (r.ok ? r.json() : { subjects: [] }))
        .then((data: { subjects?: SubjectOption[] }) => {
          setSubjects(Array.isArray(data.subjects) ? data.subjects : []);
        });
    }
  }, [examBoardId, isCashIn]);

  useEffect(() => {
    if (!isCashIn) {
      setExamSeriesId("");
      setSubjectId("");
      setSubjectFilter("");
    }
  }, [isCashIn]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/fee-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examBoardId,
          serviceType,
          examSeriesId: isCashIn && examSeriesId ? examSeriesId : null,
          subjectId: isCashIn && subjectId ? subjectId : null,
          effectiveFrom: dateInputValueToIso(effectiveFrom),
          costCurrency,
          costAmount: Number(costAmount),
          salesCurrency,
          salesAmount: Number(salesAmount),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to create fee schedule version");
      }

      setCostAmount("");
      setSalesAmount("");
      await loadSchedules();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Schedule"
        description="Versioned fee schedule shared by registration and post-results services. For Cash-in, prefer pricing by exam series; leave series/subject empty for broader defaults."
      />

      {isCashIn ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Cash-in codes are configured separately.{" "}
          <Link href={`${basePath}/cash-in-codes`} className="font-medium underline">
            Open Cash-in Codes
          </Link>
          . Lookup order: series+subject → series → subject → board.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleCreate} className="space-y-4 border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">New fee schedule version</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Exam board</span>
            <select
              required
              value={examBoardId}
              onChange={(e) => setExamBoardId(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2"
            >
              <option value="">Select board</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Service type</span>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as FeeScheduleServiceType)}
              className="w-full border border-slate-300 px-3 py-2"
            >
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          {isCashIn ? (
            <>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Exam series (optional)
                </span>
                <select
                  value={examSeriesId}
                  onChange={(e) => setExamSeriesId(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2"
                  disabled={!examBoardId}
                >
                  <option value="">Board / cross-series default</option>
                  {series.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">Subject (optional)</span>
                <input
                  type="search"
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  placeholder="Filter by code, name, or level…"
                  className="mb-2 w-full border border-slate-300 px-3 py-2"
                  disabled={!examBoardId}
                />
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2"
                  disabled={!examBoardId}
                >
                  <option value="">Any subject (series/board default)</option>
                  {filteredSubjects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} — {item.name}
                      {item.level ? ` · ${item.level}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Qualification is derived from the subject when set.
                </p>
              </label>
            </>
          ) : null}

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Effective from</span>
            <input
              required
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Cost</span>
            <div className="flex gap-2">
              <select
                value={costCurrency}
                onChange={(e) => setCostCurrency(e.target.value as "GBP" | "CNY")}
                className="border border-slate-300 px-2 py-2"
              >
                <option value="GBP">GBP</option>
                <option value="CNY">CNY</option>
              </select>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={costAmount}
                onChange={(e) => setCostAmount(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2"
              />
            </div>
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Sales price</span>
            <div className="flex gap-2">
              <select
                value={salesCurrency}
                onChange={(e) => setSalesCurrency(e.target.value as "GBP" | "CNY")}
                className="border border-slate-300 px-2 py-2"
              >
                <option value="GBP">GBP</option>
                <option value="CNY">CNY</option>
              </select>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={salesAmount}
                onChange={(e) => setSalesAmount(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2"
              />
            </div>
          </label>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create version"}
        </button>
      </form>

      <div className="border border-slate-200 bg-white">
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
        ) : schedules.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No fee schedule versions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Board</th>
                  <th className="px-4 py-2">Service</th>
                  <th className="px-4 py-2">Series</th>
                  <th className="px-4 py-2">Subject</th>
                  <th className="px-4 py-2">Version</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Effective</th>
                  <th className="px-4 py-2">Cost</th>
                  <th className="px-4 py-2">Sales</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{row.examBoard?.name ?? "—"}</td>
                    <td className="px-4 py-3">{row.serviceType.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3">
                      {row.examSeries
                        ? `${row.examSeries.name} ${row.examSeries.year}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.subject
                        ? `${row.subject.code} · ${row.subject.name}`
                        : row.qualification
                          ? row.qualification.level
                          : "—"}
                    </td>
                    <td className="px-4 py-3">v{row.version}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">
                      {new Date(row.effectiveFrom).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {row.costCurrency} {row.costAmount}
                    </td>
                    <td className="px-4 py-3">
                      {row.salesCurrency} {row.salesAmount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
