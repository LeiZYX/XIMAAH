"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { RegistrationWindowFeeToolbar } from "@/components/fees/RegistrationWindowFeeToolbar";
import { formatMoney } from "@/lib/fees/money";
import { FEE_RULES_PAGE_SIZES } from "@/lib/pagination";
import { STAGE_CODE_OPTIONS, entryTypeLabel } from "@/lib/registrations/stage-labels";

interface FeeRuleRow {
  id: string;
  entryType: string;
  costCurrency?: string;
  costAmount?: number | string;
  exchangeRateToCny?: number | string | null;
  markupType?: string;
  markupValue?: number | string | null;
  salesCurrency?: string;
  salesAmount?: number | string | null;
  isActive: boolean;
  examBoard: { code: string; name: string };
  examSeries: { name: string; year: number };
  qualification: { name: string; level: string };
  subject: { code: string; name: string } | null;
  paper: { code: string; title: string } | null;
  examSession: { id: string; date: string } | null;
}

interface ExchangeRateRow {
  id: string;
  baseCurrency: string;
  targetCurrency: string;
  rate: number | string;
  effectiveDate: string;
}

interface WindowInfo {
  id: string;
  title: string;
  examBoard: { id: string; code: string; name: string };
  examSeries: { id: string; name: string; year: number };
}

interface CalendarSubjectOption {
  id: string;
  name: string;
  code: string;
  qualification: { id: string; name: string; level: string };
}

interface RegistrationWindowFeeRulesProps {
  windowId: string;
  basePath: "/admin/registration-windows" | "/exam-office/registration-windows";
  canConfigure?: boolean;
  showCosts?: boolean;
}

const bulkTemplateDefaults = {
  entryType: "NORMAL",
  costCurrency: "GBP",
  costAmount: "",
  exchangeRateToCny: "",
  markupType: "PERCENTAGE",
  markupValue: "10",
  salesCurrency: "GBP",
  salesAmount: "",
  isActive: true,
};

const emptyForm = {
  subjectId: "",
  ...bulkTemplateDefaults,
};

const emptyEditForm = {
  costCurrency: "GBP",
  costAmount: "",
  exchangeRateToCny: "",
  markupType: "PERCENTAGE",
  markupValue: "",
  salesCurrency: "GBP",
  salesAmount: "",
  isActive: true,
};

export function RegistrationWindowFeeRules({
  windowId,
  basePath,
  canConfigure = true,
  showCosts = true,
}: RegistrationWindowFeeRulesProps) {
  const [windowInfo, setWindowInfo] = useState<WindowInfo | null>(null);
  const [rules, setRules] = useState<FeeRuleRow[]>([]);
  const [rates, setRates] = useState<ExchangeRateRow[]>([]);
  const [calendarSubjects, setCalendarSubjects] = useState<CalendarSubjectOption[]>([]);
  const [calendarFilterEnabled, setCalendarFilterEnabled] = useState(false);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [rateForm, setRateForm] = useState({ rate: "9.25", effectiveDate: new Date().toISOString().slice(0, 10) });
  const [copySourceId, setCopySourceId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [editingRule, setEditingRule] = useState<FeeRuleRow | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [bulkTemplate, setBulkTemplate] = useState(bulkTemplateDefaults);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(FEE_RULES_PAGE_SIZES[0]);

  const apiBase = `/api/registration-windows/${windowId}`;

  const load = useCallback(async () => {
    const [windowRes, rulesRes, ratesRes, calendarRes, windowsRes] = await Promise.all([
      fetch(`/api/registration-windows/${windowId}`),
      fetch(`${apiBase}/fee-rules`),
      fetch(`${apiBase}/exchange-rates`),
      fetch(`${apiBase}/calendar-subjects`),
      fetch("/api/registration-windows"),
    ]);

    if (windowRes.ok) setWindowInfo(await windowRes.json());
    if (rulesRes.ok) setRules(await rulesRes.json());
    if (ratesRes.ok) setRates(await ratesRes.json());
    if (calendarRes.ok) {
      const calendarData = await calendarRes.json();
      setCalendarSubjects(Array.isArray(calendarData.subjects) ? calendarData.subjects : []);
      setCalendarFilterEnabled(Boolean(calendarData.filterEnabled));
    }
    if (windowsRes.ok) {
      const all = await windowsRes.json();
      setWindows(Array.isArray(all) ? all.filter((w: WindowInfo) => w.id !== windowId) : []);
    }
  }, [apiBase, windowId]);

  useEffect(() => {
    load();
  }, [load]);

  const calendarSubjectsHref = basePath.startsWith("/admin")
    ? "/admin/calendar-subjects"
    : null;

  const latestGbpToCny = rates.find((r) => r.baseCurrency === "GBP" && r.targetCurrency === "CNY");

  const missingBulkCount = useMemo(
    () =>
      calendarSubjects.filter(
        (subject) =>
          !rules.some(
            (rule) =>
              rule.subject?.code === subject.code &&
              !rule.paper &&
              rule.entryType === bulkTemplate.entryType,
          ),
      ).length,
    [calendarSubjects, rules, bulkTemplate.entryType],
  );

  const groupedRules = useMemo(() => {
    const groups = new Map<
      string,
      {
        subjectCode: string;
        subjectName: string;
        paperCode: string | null;
        paperTitle: string | null;
        qualification: string;
        byEntryType: Record<string, FeeRuleRow | undefined>;
      }
    >();

    for (const rule of rules) {
      const subjectCode = rule.subject?.code ?? "—";
      const paperCode = rule.paper?.code ?? null;
      const key = `${subjectCode}|${paperCode ?? ""}`;
      const existing = groups.get(key) ?? {
        subjectCode,
        subjectName: rule.subject?.name ?? "—",
        paperCode,
        paperTitle: rule.paper?.title ?? null,
        qualification: rule.qualification.name,
        byEntryType: {},
      };
      existing.byEntryType[rule.entryType] = rule;
      groups.set(key, existing);
    }

    return [...groups.values()].sort((a, b) => {
      const subjectCmp = a.subjectCode.localeCompare(b.subjectCode);
      if (subjectCmp !== 0) return subjectCmp;
      return (a.paperCode ?? "").localeCompare(b.paperCode ?? "");
    });
  }, [rules]);

  const totalSubjects = groupedRules.length;
  const totalPages = totalSubjects === 0 ? 0 : Math.ceil(totalSubjects / pageSize);

  const paginatedGroups = useMemo(() => {
    const start = (page - 1) * pageSize;
    return groupedRules.slice(start, start + pageSize);
  }, [groupedRules, page, pageSize]);

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function handleCreateRule(event: FormEvent) {
    event.preventDefault();
    if (!windowInfo || !canConfigure) return;
    setError(null);
    setMessage(null);

    const response = await fetch(`${apiBase}/fee-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examBoardId: windowInfo.examBoard.id,
        examSeriesId: windowInfo.examSeries.id,
        subjectId: form.subjectId,
        entryType: form.entryType,
        costCurrency: form.costCurrency,
        costAmount: form.costAmount,
        exchangeRateToCny: form.exchangeRateToCny || undefined,
        markupType: form.markupType,
        markupValue: form.markupValue || undefined,
        salesCurrency: form.salesCurrency,
        salesAmount: form.salesAmount || undefined,
        isActive: form.isActive,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to create fee rule");
      return;
    }

    setForm(emptyForm);
    setShowForm(false);
    setMessage("Fee rule created.");
    setPage(1);
    load();
  }

  function renderSalesCell(rule: FeeRuleRow | undefined) {
    if (!rule) return "—";
    return rule.salesAmount !== undefined && rule.salesAmount !== null
      ? formatMoney(Number(rule.salesAmount), (rule.salesCurrency ?? "GBP") as "GBP" | "CNY")
      : "Calculated";
  }

  function openEdit(rule: FeeRuleRow) {
    setEditingRule(rule);
    setEditForm({
      costCurrency: rule.costCurrency ?? "GBP",
      costAmount: rule.costAmount !== undefined ? String(rule.costAmount) : "",
      exchangeRateToCny:
        rule.exchangeRateToCny !== undefined && rule.exchangeRateToCny !== null
          ? String(rule.exchangeRateToCny)
          : "",
      markupType: rule.markupType ?? "PERCENTAGE",
      markupValue:
        rule.markupValue !== undefined && rule.markupValue !== null ? String(rule.markupValue) : "",
      salesCurrency: rule.salesCurrency ?? "GBP",
      salesAmount:
        rule.salesAmount !== undefined && rule.salesAmount !== null ? String(rule.salesAmount) : "",
      isActive: rule.isActive,
    });
    setShowForm(false);
    setShowBulkForm(false);
  }

  function openConfigure(subjectCode: string, entryType: string) {
    const subject = calendarSubjects.find((item) => item.code === subjectCode);
    setForm({
      ...bulkTemplateDefaults,
      subjectId: subject?.id ?? "",
      entryType,
    });
    setEditingRule(null);
    setShowBulkForm(false);
    setShowForm(true);
  }

  async function handleUpdateRule(event: FormEvent) {
    event.preventDefault();
    if (!editingRule || !canConfigure) return;
    setError(null);
    setMessage(null);

    const response = await fetch(`${apiBase}/fee-rules/${editingRule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        costCurrency: editForm.costCurrency,
        costAmount: editForm.costAmount,
        exchangeRateToCny: editForm.exchangeRateToCny || null,
        markupType: editForm.markupType,
        markupValue: editForm.markupValue || null,
        salesCurrency: editForm.salesCurrency,
        salesAmount: editForm.salesAmount || null,
        isActive: editForm.isActive,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to update fee rule");
      return;
    }

    setEditingRule(null);
    setMessage("Fee rule updated.");
    load();
  }

  async function handleBulkCreate(event: FormEvent) {
    event.preventDefault();
    if (!canConfigure || missingBulkCount === 0) return;
    setError(null);
    setMessage(null);
    setBulkSaving(true);

    try {
      const response = await fetch(`${apiBase}/fee-rules/bulk-calendar-subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bulkTemplate),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Bulk create failed");
      }
      setShowBulkForm(false);
      setMessage(
        `Created ${data.created} fee rules for calendar subjects${data.skipped ? ` (${data.skipped} already existed)` : ""}.`,
      );
      setPage(1);
      load();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : "Bulk create failed");
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleAddRate(event: FormEvent) {
    event.preventDefault();
    if (!canConfigure) return;

    const response = await fetch(`${apiBase}/exchange-rates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseCurrency: "GBP",
        targetCurrency: "CNY",
        rate: rateForm.rate,
        effectiveDate: rateForm.effectiveDate,
      }),
    });

    if (!response.ok) {
      setError("Failed to save exchange rate");
      return;
    }

    setMessage("Exchange rate saved.");
    load();
  }

  async function handleCopyRules() {
    if (!copySourceId || !canConfigure) return;
    const response = await fetch(`${apiBase}/fee-rules/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceWindowId: copySourceId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Copy failed");
      return;
    }
    setMessage(`Copied ${data.copiedRules} fee rules and ${data.copiedRates} exchange rates.`);
    setPage(1);
    load();
  }

  async function handleImport(file: File) {
    if (!canConfigure) return;
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${apiBase}/fee-rules/import`, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Import failed");
      return;
    }
    setMessage(
      `Imported ${data.imported} rules (${data.created ?? 0} created, ${data.updated ?? 0} updated).${
        data.skipped ? ` ${data.skipped} blank rows skipped.` : ""
      }${data.errors?.length ? ` ${data.errors.length} errors.` : ""}`,
    );
    if (data.errors?.length) setError(data.errors.slice(0, 3).join("; "));
    setPage(1);
    load();
  }

  async function toggleActive(rule: FeeRuleRow) {
    if (!canConfigure) return;
    await fetch(`${apiBase}/fee-rules/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <RegistrationWindowFeeToolbar
        windowId={windowId}
        basePath={basePath.startsWith("/admin") ? "/admin" : "/exam-office"}
        feeRulesHref={`${basePath}/${windowId}/fees`}
      />

      {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p> : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Exchange rate (GBP → CNY)</h2>
            <p className="text-sm text-slate-600">
              Current: {latestGbpToCny ? `${latestGbpToCny.rate} (from ${latestGbpToCny.effectiveDate.slice(0, 10)})` : "Not configured"}
            </p>
          </div>
          {canConfigure ? (
            <form onSubmit={handleAddRate} className="flex flex-wrap items-end gap-2">
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Rate</span>
                <input
                  required
                  type="number"
                  step="0.0001"
                  value={rateForm.rate}
                  onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
                  className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Effective date</span>
                <input
                  required
                  type="date"
                  value={rateForm.effectiveDate}
                  onChange={(e) => setRateForm({ ...rateForm, effectiveDate: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
                Save rate
              </button>
            </form>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Fee rules</h2>
            <p className="mt-1 text-sm text-slate-600">
              Configure fees per subject and entry stage (Normal Entry, Late Entry, High Late Entry).
              Bulk add calendar subjects, export to Excel, edit fees, then import to update all rules at once.
            </p>
          </div>
          {canConfigure ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowBulkForm((value) => !value);
                  setShowForm(false);
                  setEditingRule(null);
                }}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
              >
                Bulk add calendar subjects
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm((value) => !value);
                  setShowBulkForm(false);
                  setEditingRule(null);
                }}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700"
              >
                Add one subject
              </button>
              <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Import Excel
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImport(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <a
                href={`${apiBase}/fee-rules/export`}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Export Excel
              </a>
              <select
                value={copySourceId}
                onChange={(e) => setCopySourceId(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Copy from window…</option>
                {windows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!copySourceId}
                onClick={() => void handleCopyRules()}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Copy rules
              </button>
            </div>
          ) : null}
        </div>

        {showBulkForm && canConfigure ? (
          <form onSubmit={handleBulkCreate} className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
            <p className="text-sm text-slate-700">
              Create fee rules for all calendar subjects that do not already have a{" "}
              <span className="font-medium">{entryTypeLabel(bulkTemplate.entryType)}</span> rule.
              {missingBulkCount > 0
                ? ` ${missingBulkCount} subject${missingBulkCount === 1 ? "" : "s"} will be added.`
                : " All calendar subjects already have a matching rule."}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <select
                value={bulkTemplate.entryType}
                onChange={(e) => setBulkTemplate({ ...bulkTemplate, entryType: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {STAGE_CODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {showCosts ? (
                <>
                  <select
                    value={bulkTemplate.costCurrency}
                    onChange={(e) => setBulkTemplate({ ...bulkTemplate, costCurrency: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="GBP">Cost GBP</option>
                    <option value="CNY">Cost CNY</option>
                  </select>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="Cost amount"
                    value={bulkTemplate.costAmount}
                    onChange={(e) => setBulkTemplate({ ...bulkTemplate, costAmount: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="Exchange rate override"
                    value={bulkTemplate.exchangeRateToCny}
                    onChange={(e) =>
                      setBulkTemplate({ ...bulkTemplate, exchangeRateToCny: e.target.value })
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={bulkTemplate.markupType}
                    onChange={(e) => setBulkTemplate({ ...bulkTemplate, markupType: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="PERCENTAGE">Markup %</option>
                    <option value="FIXED_AMOUNT">Markup fixed</option>
                    <option value="MANUAL">Manual sales price</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Markup value"
                    value={bulkTemplate.markupValue}
                    onChange={(e) => setBulkTemplate({ ...bulkTemplate, markupValue: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </>
              ) : null}
              <select
                value={bulkTemplate.salesCurrency}
                onChange={(e) => setBulkTemplate({ ...bulkTemplate, salesCurrency: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="GBP">Sales GBP</option>
                <option value="CNY">Sales CNY</option>
              </select>
              {bulkTemplate.markupType === "MANUAL" ? (
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder="Sales amount"
                  value={bulkTemplate.salesAmount}
                  onChange={(e) => setBulkTemplate({ ...bulkTemplate, salesAmount: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              ) : null}
              <button
                type="submit"
                disabled={bulkSaving || missingBulkCount === 0 || !bulkTemplate.costAmount}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 lg:col-span-3"
              >
                {bulkSaving
                  ? "Creating..."
                  : `Create ${missingBulkCount} calendar subject rule${missingBulkCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </form>
        ) : null}

        {showForm && canConfigure ? (
          <form onSubmit={handleCreateRule} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              New fee rules apply to one calendar subject at a time.
              {calendarFilterEnabled
                ? " Only subjects selected under Calendar Subjects are listed."
                : " All subjects for this exam board are listed until calendar filtering is enabled."}
              {calendarSubjectsHref ? (
                <>
                  {" "}
                  <a href={calendarSubjectsHref} className="font-medium text-indigo-600 hover:underline">
                    Manage calendar subjects
                  </a>
                </>
              ) : null}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <select
              required
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2 lg:col-span-3"
            >
              <option value="">Calendar subject</option>
              {calendarSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} — {subject.name} ({subject.qualification.level} · {subject.qualification.name})
                </option>
              ))}
            </select>
            {calendarSubjects.length === 0 ? (
              <p className="text-sm text-amber-700 sm:col-span-2 lg:col-span-3">
                No calendar subjects available for this exam board. Configure subjects first.
              </p>
            ) : null}
            <select
              value={form.entryType}
              onChange={(e) => setForm({ ...form, entryType: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {STAGE_CODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {showCosts ? (
              <>
                <select
                  value={form.costCurrency}
                  onChange={(e) => setForm({ ...form, costCurrency: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="GBP">Cost GBP</option>
                  <option value="CNY">Cost CNY</option>
                </select>
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder="Cost amount"
                  value={form.costAmount}
                  onChange={(e) => setForm({ ...form, costAmount: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  step="0.0001"
                  placeholder="Exchange rate override"
                  value={form.exchangeRateToCny}
                  onChange={(e) => setForm({ ...form, exchangeRateToCny: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={form.markupType}
                  onChange={(e) => setForm({ ...form, markupType: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="PERCENTAGE">Markup %</option>
                  <option value="FIXED_AMOUNT">Markup fixed</option>
                  <option value="MANUAL">Manual sales price</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Markup value"
                  value={form.markupValue}
                  onChange={(e) => setForm({ ...form, markupValue: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </>
            ) : null}
            <select
              value={form.salesCurrency}
              onChange={(e) => setForm({ ...form, salesCurrency: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="GBP">Sales GBP</option>
              <option value="CNY">Sales CNY</option>
            </select>
            {form.markupType === "MANUAL" ? (
              <input
                required
                type="number"
                step="0.01"
                placeholder="Sales amount"
                value={form.salesAmount}
                onChange={(e) => setForm({ ...form, salesAmount: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            ) : null}
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white sm:col-span-2 lg:col-span-3">
              Save fee rule
            </button>
            </div>
          </form>
        ) : null}

        {editingRule && canConfigure ? (
          <form onSubmit={handleUpdateRule} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">
                Edit fee rule — {editingRule.subject?.code ?? "—"} · {entryTypeLabel(editingRule.entryType)}
              </p>
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {showCosts ? (
                <>
                  <select
                    value={editForm.costCurrency}
                    onChange={(e) => setEditForm({ ...editForm, costCurrency: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="GBP">Cost GBP</option>
                    <option value="CNY">Cost CNY</option>
                  </select>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="Cost amount"
                    value={editForm.costAmount}
                    onChange={(e) => setEditForm({ ...editForm, costAmount: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="Exchange rate override"
                    value={editForm.exchangeRateToCny}
                    onChange={(e) => setEditForm({ ...editForm, exchangeRateToCny: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={editForm.markupType}
                    onChange={(e) => setEditForm({ ...editForm, markupType: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="PERCENTAGE">Markup %</option>
                    <option value="FIXED_AMOUNT">Markup fixed</option>
                    <option value="MANUAL">Manual sales price</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Markup value"
                    value={editForm.markupValue}
                    onChange={(e) => setEditForm({ ...editForm, markupValue: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </>
              ) : null}
              <select
                value={editForm.salesCurrency}
                onChange={(e) => setEditForm({ ...editForm, salesCurrency: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="GBP">Sales GBP</option>
                <option value="CNY">Sales CNY</option>
              </select>
              {editForm.markupType === "MANUAL" ? (
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder="Sales amount"
                  value={editForm.salesAmount}
                  onChange={(e) => setEditForm({ ...editForm, salesAmount: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              ) : null}
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2 lg:col-span-3">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                Active
              </label>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white sm:col-span-2 lg:col-span-3"
              >
                Save changes
              </button>
            </div>
          </form>
        ) : null}

        <div className="overflow-x-auto">
          {groupedRules.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No fee rules configured yet.</p>
          ) : (
            paginatedGroups.map((group) => (
              <div key={`${group.subjectCode}|${group.paperCode ?? ""}`} className="mb-6 last:mb-0">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                  {group.subjectCode} — {group.subjectName}
                  {group.paperCode ? ` · Paper ${group.paperCode}` : ""}
                  <span className="ml-2 font-normal text-slate-500">({group.qualification})</span>
                </h3>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-slate-500">
                      <th className="py-2 pr-3">Entry stage</th>
                      {showCosts ? (
                        <>
                          <th className="py-2 pr-3">Cost</th>
                          <th className="py-2 pr-3">Rate</th>
                          <th className="py-2 pr-3">Markup</th>
                        </>
                      ) : null}
                      <th className="py-2 pr-3">Sales</th>
                      <th className="py-2 pr-3">Active</th>
                      {canConfigure ? <th className="py-2 pr-3">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {STAGE_CODE_OPTIONS.map((stage) => {
                      const rule = group.byEntryType[stage.value];
                      return (
                        <tr key={stage.value} className="border-b border-slate-100">
                          <td className="py-2 pr-3">{stage.label}</td>
                          {showCosts ? (
                            <>
                              <td className="py-2 pr-3">
                                {rule?.costCurrency && rule.costAmount !== undefined
                                  ? formatMoney(Number(rule.costAmount), rule.costCurrency as "GBP" | "CNY")
                                  : "—"}
                              </td>
                              <td className="py-2 pr-3">{rule?.exchangeRateToCny ?? latestGbpToCny?.rate ?? "—"}</td>
                              <td className="py-2 pr-3">
                                {rule
                                  ? rule.markupType === "MANUAL"
                                    ? "Manual"
                                    : `${rule.markupType} ${rule.markupValue ?? ""}`
                                  : "—"}
                              </td>
                            </>
                          ) : null}
                          <td className="py-2 pr-3">{renderSalesCell(rule)}</td>
                          <td className="py-2 pr-3">{rule ? (rule.isActive ? "Yes" : "No") : "—"}</td>
                          {canConfigure ? (
                            <td className="py-2 pr-3">
                              {rule ? (
                                <div className="flex flex-wrap gap-3">
                                  <button
                                    type="button"
                                    onClick={() => openEdit(rule)}
                                    className="text-indigo-600"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void toggleActive(rule)}
                                    className="text-indigo-600"
                                  >
                                    {rule.isActive ? "Deactivate" : "Activate"}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openConfigure(group.subjectCode, stage.value)}
                                  className="text-indigo-600"
                                >
                                  Configure
                                </button>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>

        {groupedRules.length > 0 ? (
          <ListPagination
            page={page}
            pageSize={pageSize}
            total={totalSubjects}
            totalPages={totalPages}
            itemLabel="subjects"
            pageSizes={FEE_RULES_PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        ) : null}
      </Card>
    </div>
  );
}
