"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { datetimeLocalValueToIso } from "@/lib/datetime-local";
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
}

interface ExamBoardOption {
  id: string;
  name: string;
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

export function FeeScheduleManager() {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [boards, setBoards] = useState<ExamBoardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [examBoardId, setExamBoardId] = useState("");
  const [serviceType, setServiceType] = useState<FeeScheduleServiceType>("EXAM_ENTRY");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [costCurrency, setCostCurrency] = useState<"GBP" | "CNY">("GBP");
  const [costAmount, setCostAmount] = useState("");
  const [salesCurrency, setSalesCurrency] = useState<"GBP" | "CNY">("GBP");
  const [salesAmount, setSalesAmount] = useState("");

  async function loadSchedules() {
    setLoading(true);
    const response = await fetch("/api/fee-schedules");
    if (response.ok) setSchedules(await response.json());
    setLoading(false);
  }

  useEffect(() => {
    loadSchedules();
    fetch("/api/exam-boards")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setBoards(data));
  }, []);

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
          effectiveFrom: datetimeLocalValueToIso(effectiveFrom),
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
        description="Versioned fee schedule shared by registration and post-results services. Price changes create new versions."
      />

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
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Effective from</span>
            <input
              required
              type="datetime-local"
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
                    <td className="px-4 py-3">v{row.version}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">
                      {new Date(row.effectiveFrom).toLocaleString()}
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
