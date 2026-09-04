"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { RegistrationWindowFeeToolbar } from "@/components/fees/RegistrationWindowFeeToolbar";
import { formatMoney, roundMoney, toNumber } from "@/lib/fees/money";
import { FEE_RULES_PAGE_SIZES } from "@/lib/pagination";
import { STAGE_CODE_OPTIONS } from "@/lib/registrations/stage-labels";

interface FeeRuleRow {
  id: string;
  entryType: string;
  costCurrency?: string;
  costAmount?: number | string;
  markupType?: string;
  markupValue?: number | string | null;
  salesCurrency?: string;
  salesAmount?: number | string | null;
  isActive: boolean;
  qualification: { id?: string; name: string; level: string };
  subject: { id?: string; code: string; name: string } | null;
  paper: { code: string; title: string } | null;
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
  academicYear?: string;
  examBoard: { id: string; code: string; name: string };
  examSeries: { id: string; name: string; year: number };
}

interface StageDraft {
  ruleId: string | null;
  costAmount: string;
  salesAmount: string;
  isActive: boolean;
}

interface SubjectRowDraft {
  key: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  qualification: string;
  stages: Record<string, StageDraft>;
  dirty: boolean;
  saving: boolean;
}

interface FormulaSettings {
  lateMultiplier: string;
  highLateMultiplier: string;
  salesMarkupPercent: string;
}

type FeedbackTone = "ok" | "error";

interface Feedback {
  tone: FeedbackTone;
  text: string;
}

interface RegistrationWindowFeeRulesProps {
  windowId: string;
  basePath: "/admin/registration-windows" | "/exam-office/registration-windows";
  canConfigure?: boolean;
  showCosts?: boolean;
}

const DEFAULT_FORMULA: FormulaSettings = {
  lateMultiplier: "2",
  highLateMultiplier: "3",
  salesMarkupPercent: "20",
};

function salesFromCost(cost: number, markupPercent: number): number {
  return roundMoney(cost * (1 + markupPercent / 100));
}

function applyFormulaToStages(
  normalCost: number,
  settings: FormulaSettings,
): Record<string, { costAmount: string; salesAmount: string }> {
  const lateMult = Number(settings.lateMultiplier) || 0;
  const highMult = Number(settings.highLateMultiplier) || 0;
  const markup = Number(settings.salesMarkupPercent) || 0;

  const normal = roundMoney(normalCost);
  const late = roundMoney(normal * lateMult);
  const high = roundMoney(normal * highMult);

  return {
    NORMAL: {
      costAmount: String(normal),
      salesAmount: String(salesFromCost(normal, markup)),
    },
    LATE: {
      costAmount: String(late),
      salesAmount: String(salesFromCost(late, markup)),
    },
    HIGH_LATE: {
      costAmount: String(high),
      salesAmount: String(salesFromCost(high, markup)),
    },
  };
}

function withFormulaApplied(row: SubjectRowDraft, settings: FormulaSettings): SubjectRowDraft {
  const normalCost = toNumber(row.stages.NORMAL?.costAmount);
  const filled = applyFormulaToStages(normalCost, settings);
  const stages = { ...row.stages };
  for (const stage of STAGE_CODE_OPTIONS) {
    const values = filled[stage.value]!;
    stages[stage.value] = {
      ...stages[stage.value]!,
      costAmount: values.costAmount,
      salesAmount: values.salesAmount,
    };
  }
  return { ...row, stages, dirty: true };
}

function buildRowsFromRules(rules: FeeRuleRow[]): SubjectRowDraft[] {
  const groups = new Map<string, SubjectRowDraft>();

  for (const rule of rules) {
    if (!rule.subject?.id || rule.paper) continue;
    const key = rule.subject.id;
    const existing = groups.get(key) ?? {
      key,
      subjectId: rule.subject.id,
      subjectCode: rule.subject.code,
      subjectName: rule.subject.name,
      qualification: `${rule.qualification.level} · ${rule.qualification.name}`,
      stages: Object.fromEntries(
        STAGE_CODE_OPTIONS.map((stage) => [
          stage.value,
          { ruleId: null, costAmount: "0", salesAmount: "0", isActive: true },
        ]),
      ),
      dirty: false,
      saving: false,
    };

    existing.stages[rule.entryType] = {
      ruleId: rule.id,
      costAmount: String(toNumber(rule.costAmount)),
      salesAmount: String(toNumber(rule.salesAmount)),
      isActive: rule.isActive,
    };
    groups.set(key, existing);
  }

  return [...groups.values()].sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
}

function FeedbackBanner({
  feedback,
  onDismiss,
  sticky = false,
}: {
  feedback: Feedback | null;
  onDismiss?: () => void;
  sticky?: boolean;
}) {
  if (!feedback) return null;
  const ok = feedback.tone === "ok";
  return (
    <div
      role="status"
      className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
        ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
      } ${sticky ? "sticky top-0 z-20 shadow-sm ring-1 ring-black/5" : ""}`}
    >
      <p className="min-w-0 flex-1">{feedback.text}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-medium opacity-70 hover:opacity-100"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

export function RegistrationWindowFeeRules({
  windowId,
  basePath,
  canConfigure = true,
  showCosts = true,
}: RegistrationWindowFeeRulesProps) {
  const [windowInfo, setWindowInfo] = useState<WindowInfo | null>(null);
  const [rates, setRates] = useState<ExchangeRateRow[]>([]);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [rows, setRows] = useState<SubjectRowDraft[]>([]);
  const [formula, setFormula] = useState<FormulaSettings>(DEFAULT_FORMULA);
  const [rateForm, setRateForm] = useState({
    rate: "9.25",
    effectiveDate: new Date().toISOString().slice(0, 10),
  });
  const [copySourceId, setCopySourceId] = useState("");
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [rulesFeedback, setRulesFeedback] = useState<Feedback | null>(null);
  const [rateFeedback, setRateFeedback] = useState<Feedback | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(FEE_RULES_PAGE_SIZES[0]);
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const rulesFeedbackRef = useRef<HTMLDivElement | null>(null);

  const apiBase = `/api/registration-windows/${windowId}`;

  const showRulesFeedback = useCallback((tone: FeedbackTone, text: string) => {
    setRulesFeedback({ tone, text });
    // Keep the banner in view near the fee-rules actions.
    requestAnimationFrame(() => {
      rulesFeedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const loadRulesOnly = useCallback(async () => {
    const rulesRes = await fetch(`${apiBase}/fee-rules`);
    if (!rulesRes.ok) return;
    const rules = (await rulesRes.json()) as FeeRuleRow[];
    setRows(buildRowsFromRules(rules));
  }, [apiBase]);

  const load = useCallback(async () => {
    const [windowRes, rulesRes, ratesRes] = await Promise.all([
      fetch(`/api/registration-windows/${windowId}`),
      fetch(`${apiBase}/fee-rules`),
      fetch(`${apiBase}/exchange-rates`),
    ]);

    if (windowRes.ok) {
      const windowData = await windowRes.json();
      setWindowInfo(windowData);
      if (windowData?.academicYear) {
        const scoped = await fetch(
          `/api/registration-windows?academicYear=${encodeURIComponent(windowData.academicYear)}&scope=staff`,
        );
        if (scoped.ok) {
          const scopedData = await scoped.json();
          setWindows(
            Array.isArray(scopedData)
              ? scopedData.filter((w: WindowInfo) => w.id !== windowId)
              : [],
          );
        }
      }
    }
    if (rulesRes.ok) {
      setRows(buildRowsFromRules(await rulesRes.json()));
    }
    if (ratesRes.ok) setRates(await ratesRes.json());
  }, [apiBase, windowId]);

  const syncSeriesSubjects = useCallback(
    async (quiet = false) => {
      if (!canConfigure) return;
      setSyncing(true);
      if (!quiet) setRulesFeedback(null);
      try {
        const response = await fetch(`${apiBase}/fee-rules/sync-series-subjects`, {
          method: "POST",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Sync failed");
        await loadRulesOnly();
        if (!quiet || data.created > 0) {
          showRulesFeedback(
            "ok",
            data.created > 0
              ? `Synced series subjects: added ${data.created} fee rule(s) across ${data.subjects} subject(s) (cost/sales default £0).`
              : `Series subjects already synced (${data.subjects} subject(s)).`,
          );
        }
      } catch (syncError) {
        showRulesFeedback(
          "error",
          syncError instanceof Error ? syncError.message : "Sync failed",
        );
      } finally {
        setSyncing(false);
      }
    },
    [apiBase, canConfigure, loadRulesOnly, showRulesFeedback],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canConfigure || initialSyncDone) return;
    setInitialSyncDone(true);
    void syncSeriesSubjects(true);
  }, [canConfigure, initialSyncDone, syncSeriesSubjects]);

  const latestGbpToCny = rates.find((r) => r.baseCurrency === "GBP" && r.targetCurrency === "CNY");

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.subjectCode} ${row.subjectName} ${row.qualification}`.toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const totalSubjects = filteredRows.length;
  const totalPages = totalSubjects === 0 ? 0 : Math.ceil(totalSubjects / pageSize);
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function updateStage(rowKey: string, entryType: string, patch: Partial<StageDraft>) {
    setRows((current) =>
      current.map((row) => {
        if (row.key !== rowKey) return row;
        return {
          ...row,
          dirty: true,
          stages: {
            ...row.stages,
            [entryType]: { ...row.stages[entryType]!, ...patch },
          },
        };
      }),
    );
  }

  async function persistRow(row: SubjectRowDraft) {
    for (const stage of STAGE_CODE_OPTIONS) {
      const draft = row.stages[stage.value];
      if (!draft?.ruleId) continue;

      const response = await fetch(`${apiBase}/fee-rules/${draft.ruleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          costCurrency: "GBP",
          costAmount: draft.costAmount || "0",
          markupType: "MANUAL",
          markupValue: null,
          salesCurrency: "GBP",
          salesAmount: draft.salesAmount || "0",
          isActive: draft.isActive,
          exchangeRateToCny: null,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed to save ${stage.label}`);
      }
    }
  }

  function markRowSaving(rowKey: string, saving: boolean, dirty?: boolean) {
    setRows((current) =>
      current.map((item) =>
        item.key === rowKey
          ? {
              ...item,
              saving,
              ...(typeof dirty === "boolean" ? { dirty } : {}),
            }
          : item,
      ),
    );
  }

  async function saveRow(rowKey: string) {
    if (!canConfigure || !windowInfo) return;
    const row = rows.find((item) => item.key === rowKey);
    if (!row) return;

    markRowSaving(rowKey, true);
    try {
      await persistRow(row);
      markRowSaving(rowKey, false, false);
      showRulesFeedback("ok", `Saved fees for ${row.subjectCode}.`);
    } catch (saveError) {
      markRowSaving(rowKey, false);
      showRulesFeedback(
        "error",
        saveError instanceof Error ? saveError.message : "Save failed",
      );
    }
  }

  async function applyFormulaAndSaveRow(rowKey: string) {
    if (!canConfigure || !windowInfo) return;
    const current = rows.find((item) => item.key === rowKey);
    if (!current) return;

    const applied = withFormulaApplied(current, formula);
    setRows((list) =>
      list.map((item) => (item.key === rowKey ? { ...applied, saving: true } : item)),
    );

    try {
      await persistRow(applied);
      setRows((list) =>
        list.map((item) =>
          item.key === rowKey ? { ...item, dirty: false, saving: false } : item,
        ),
      );
      showRulesFeedback("ok", `Applied formula and saved ${applied.subjectCode}.`);
    } catch (saveError) {
      setRows((list) =>
        list.map((item) =>
          item.key === rowKey ? { ...applied, dirty: true, saving: false } : item,
        ),
      );
      showRulesFeedback(
        "error",
        saveError instanceof Error
          ? `Formula applied on screen but save failed: ${saveError.message}`
          : "Formula applied on screen but save failed",
      );
    }
  }

  async function applyFormulaAndSaveAll() {
    if (!canConfigure || !windowInfo || rows.length === 0) return;

    const appliedRows = rows.map((row) => withFormulaApplied(row, formula));
    setApplyingAll(true);
    setRows(appliedRows.map((row) => ({ ...row, saving: true })));
    showRulesFeedback("ok", `Applying formula and saving ${appliedRows.length} subject(s)…`);

    let saved = 0;
    const failures: string[] = [];

    for (const row of appliedRows) {
      try {
        await persistRow(row);
        saved += 1;
        setRows((list) =>
          list.map((item) =>
            item.key === row.key ? { ...item, dirty: false, saving: false } : item,
          ),
        );
      } catch (saveError) {
        failures.push(
          `${row.subjectCode}: ${
            saveError instanceof Error ? saveError.message : "save failed"
          }`,
        );
        setRows((list) =>
          list.map((item) =>
            item.key === row.key ? { ...item, dirty: true, saving: false } : item,
          ),
        );
      }
    }

    setApplyingAll(false);
    if (failures.length === 0) {
      showRulesFeedback(
        "ok",
        `Applied formula and saved all ${saved} subject(s).`,
      );
    } else {
      showRulesFeedback(
        "error",
        `Saved ${saved}/${appliedRows.length}. Failed: ${failures.slice(0, 3).join("; ")}${
          failures.length > 3 ? "…" : ""
        }`,
      );
    }
  }

  async function handleAddRate(event: FormEvent) {
    event.preventDefault();
    if (!canConfigure) return;
    setRateFeedback(null);
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
      setRateFeedback({ tone: "error", text: "Failed to save exchange rate" });
      return;
    }
    setRateFeedback({ tone: "ok", text: "Exchange rate saved." });
    void load();
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
      showRulesFeedback("error", data.error ?? "Copy failed");
      return;
    }
    showRulesFeedback(
      "ok",
      `Copied ${data.copiedRules} fee rules and ${data.copiedRates} exchange rates.`,
    );
    setShowCopyPanel(false);
    await load();
    await syncSeriesSubjects(true);
  }

  async function handleImport(file: File) {
    if (!canConfigure) return;
    showRulesFeedback("ok", `Importing ${file.name}…`);
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${apiBase}/fee-rules/import`, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) {
      showRulesFeedback("error", data.error ?? "Import failed");
      return;
    }
    const detail = data.errors?.length
      ? ` Warnings: ${data.errors.slice(0, 3).join("; ")}`
      : "";
    showRulesFeedback(
      data.errors?.length ? "error" : "ok",
      `Imported ${data.imported} rules (${data.created ?? 0} created, ${data.updated ?? 0} updated).${detail}`,
    );
    await load();
    await syncSeriesSubjects(true);
  }

  return (
    <div className="space-y-6">
      <RegistrationWindowFeeToolbar
        windowId={windowId}
        basePath={basePath.startsWith("/admin") ? "/admin" : "/exam-office"}
        feeRulesHref={`${basePath}/${windowId}/fees`}
      />

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Exchange rate (GBP → CNY)</h2>
            <p className="text-sm text-slate-600">
              Current:{" "}
              {latestGbpToCny
                ? `${latestGbpToCny.rate} (from ${latestGbpToCny.effectiveDate.slice(0, 10)})`
                : "Not configured"}
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
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
              >
                Save rate
              </button>
            </form>
          ) : null}
        </div>
        <FeedbackBanner feedback={rateFeedback} onDismiss={() => setRateFeedback(null)} />
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Fee rules</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              One row per subject from this window’s exam series. Edit values freely, then Save row —
              or use Apply &amp; save to fill Late / High Late from Normal and persist immediately.
            </p>
          </div>
          {canConfigure ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={syncing || applyingAll}
                onClick={() => void syncSeriesSubjects(false)}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync series subjects"}
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
              <button
                type="button"
                onClick={() => setShowCopyPanel((value) => !value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Copy from window
              </button>
            </div>
          ) : null}
        </div>

        <div ref={rulesFeedbackRef}>
          <FeedbackBanner
            feedback={rulesFeedback}
            onDismiss={() => setRulesFeedback(null)}
            sticky
          />
        </div>

        {canConfigure ? (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Pricing formula</h3>
              <p className="mt-0.5 text-xs text-slate-600">
                Late / High Late cost from Normal × multipliers; each stage’s sales = cost + %.
                Apply &amp; save writes to the database in one step.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Late = Normal ×</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formula.lateMultiplier}
                  onChange={(e) => setFormula({ ...formula, lateMultiplier: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">High Late = Normal ×</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formula.highLateMultiplier}
                  onChange={(e) => setFormula({ ...formula, highLateMultiplier: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Sales = Cost + %</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formula.salesMarkupPercent}
                  onChange={(e) => setFormula({ ...formula, salesMarkupPercent: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={applyingAll || syncing || rows.length === 0}
                  onClick={() => void applyFormulaAndSaveAll()}
                  className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {applyingAll ? "Saving…" : "Apply & save all"}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Example with Normal cost £10: Late cost = £
              {(10 * (Number(formula.lateMultiplier) || 0)).toFixed(2)}, High Late cost = £
              {(10 * (Number(formula.highLateMultiplier) || 0)).toFixed(2)}, sales = cost +{" "}
              {formula.salesMarkupPercent}%.
            </p>
          </div>
        ) : null}

        {showCopyPanel && canConfigure ? (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Source window</span>
              <select
                value={copySourceId}
                onChange={(e) => setCopySourceId(e.target.value)}
                className="min-w-[16rem] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select window…</option>
                {windows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!copySourceId}
              onClick={() => void handleCopyRules()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Copy rules & rates
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subject…"
            className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="text-sm text-slate-500">
            {totalSubjects} subject{totalSubjects === 1 ? "" : "s"}
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          {rows.length === 0 ? (
            <div className="space-y-2 px-4 py-10 text-center text-sm text-slate-600">
              <p>No fee rules yet.</p>
              <p className="text-slate-500">
                Add exam sessions for this series, then click Sync series subjects.
              </p>
            </div>
          ) : filteredRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">No subjects match.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Subject</th>
                  {STAGE_CODE_OPTIONS.map((stage) => (
                    <th key={stage.value} className="px-3 py-3">
                      {stage.label.replace(" Entry", "")}
                      {showCosts ? " cost / sales" : " sales"}
                    </th>
                  ))}
                  {canConfigure ? <th className="px-3 py-3">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <tr
                    key={row.key}
                    className={`border-t border-slate-100 ${row.dirty ? "bg-amber-50/40" : ""}`}
                  >
                    <td className="px-3 py-3 align-top">
                      <p className="font-semibold text-slate-900">{row.subjectCode}</p>
                      <p className="text-slate-700">{row.subjectName}</p>
                      <p className="text-xs text-slate-500">{row.qualification}</p>
                    </td>
                    {STAGE_CODE_OPTIONS.map((stage) => {
                      const draft = row.stages[stage.value]!;
                      return (
                        <td key={stage.value} className="px-3 py-3 align-top">
                          {canConfigure ? (
                            <div className="space-y-1">
                              {showCosts ? (
                                <label className="block">
                                  <span className="text-[11px] uppercase text-slate-400">Cost</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={draft.costAmount}
                                    onChange={(e) =>
                                      updateStage(row.key, stage.value, {
                                        costAmount: e.target.value,
                                      })
                                    }
                                    className="mt-0.5 w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                                  />
                                </label>
                              ) : null}
                              <label className="block">
                                <span className="text-[11px] uppercase text-slate-400">Sales</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={draft.salesAmount}
                                  onChange={(e) =>
                                    updateStage(row.key, stage.value, {
                                      salesAmount: e.target.value,
                                    })
                                  }
                                  className="mt-0.5 w-24 rounded border border-slate-300 px-2 py-1 text-sm font-medium"
                                />
                              </label>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              {showCosts ? (
                                <p className="text-xs text-slate-500">
                                  Cost {formatMoney(toNumber(draft.costAmount), "GBP")}
                                </p>
                              ) : null}
                              <p className="font-semibold text-slate-900">
                                {formatMoney(toNumber(draft.salesAmount), "GBP")}
                              </p>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {canConfigure ? (
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            disabled={row.saving || applyingAll}
                            onClick={() => void applyFormulaAndSaveRow(row.key)}
                            className="text-left text-sm text-indigo-600 hover:underline disabled:opacity-40"
                          >
                            {row.saving ? "Saving…" : "Apply & save"}
                          </button>
                          <button
                            type="button"
                            disabled={!row.dirty || row.saving || applyingAll}
                            onClick={() => void saveRow(row.key)}
                            className="rounded bg-indigo-600 px-2 py-1 text-left text-xs font-medium text-white disabled:opacity-40"
                          >
                            {row.saving ? "Saving…" : row.dirty ? "Save row" : "Saved"}
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filteredRows.length > 0 ? (
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

      {rulesFeedback ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div
            className={`pointer-events-auto max-w-xl rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ring-black/10 ${
              rulesFeedback.tone === "ok"
                ? "bg-green-700 text-white"
                : "bg-red-700 text-white"
            }`}
          >
            <div className="flex items-start gap-3">
              <p className="min-w-0 flex-1">{rulesFeedback.text}</p>
              <button
                type="button"
                onClick={() => setRulesFeedback(null)}
                className="shrink-0 text-xs font-medium text-white/80 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
