"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { FeeManagementNav } from "@/components/fees/FeeManagementNav";
import { filtersToParams } from "@/components/fees/FeeReportFiltersForm";
import {
  RegistrationWindowSelectorFields,
  useRegistrationWindowSelector,
} from "@/components/registrations/RegistrationWindowSelector";
import { formatEnglishWithChineseName } from "@/lib/candidates/identity";
import type { FeeReportFilters } from "@/lib/fees/filters";
import type {
  FeeSummaryCards,
  FeeSummaryFacet,
  FeeSummaryRow,
} from "@/lib/fees/reporting";
import { formatMoney } from "@/lib/fees/money";
import {
  feeStatementStatusClass,
} from "@/lib/fees/workspace-status";

interface FeeSummaryViewProps {
  basePath: "/admin" | "/exam-office" | "/finance";
}

type CandidateTypeSelection = "INTERNAL" | "EXTERNAL";

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <Card>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </Card>
  );
}

function TipBanner({
  text,
  onDismiss,
}: {
  text: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800"
    >
      <p className="min-w-0 flex-1">{text}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-xs font-medium opacity-70 hover:opacity-100"
      >
        Dismiss
      </button>
    </div>
  );
}

export function FeeSummaryView({ basePath }: FeeSummaryViewProps) {
  const [candidateType, setCandidateType] = useState<CandidateTypeSelection>("INTERNAL");
  const [selectedGrade, setSelectedGrade] = useState<string>("ALL");
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [statementStatus, setStatementStatus] = useState("");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [cards, setCards] = useState<FeeSummaryCards | null>(null);
  const [rows, setRows] = useState<FeeSummaryRow[]>([]);
  const [byGrade, setByGrade] = useState<FeeSummaryFacet[]>([]);
  const [byClass, setByClass] = useState<FeeSummaryFacet[]>([]);
  const [systemTips, setSystemTips] = useState<string[]>([]);
  const [dismissedTips, setDismissedTips] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const selector = useRegistrationWindowSelector({
    scope: "staff",
    allowEmpty: true,
  });

  const filters = useMemo<FeeReportFilters>(() => {
    const next: FeeReportFilters = {
      candidateType,
    };
    if (selector.registrationWindowId) {
      next.registrationWindowId = selector.registrationWindowId;
    }
    if (selectedGrade !== "ALL") next.grade = selectedGrade;
    if (selectedClass !== "ALL") next.className = selectedClass;
    if (statementStatus) {
      next.statementStatus = statementStatus as FeeReportFilters["statementStatus"];
    }
    if (appliedQ.trim()) next.q = appliedQ.trim();
    return next;
  }, [
    appliedQ,
    candidateType,
    selectedClass,
    selectedGrade,
    selector.registrationWindowId,
    statementStatus,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/fees/summary?${filtersToParams(filters)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load summary");
      setCards(data.cards);
      setRows(data.rows ?? []);
      setByGrade(Array.isArray(data.byGrade) ? data.byGrade : []);
      setByClass(Array.isArray(data.byClass) ? data.byClass : []);
      setSystemTips(Array.isArray(data.systemTips) ? data.systemTips : []);
      setDismissedTips([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summary");
      setCards(null);
      setRows([]);
      setByGrade([]);
      setByClass([]);
      setSystemTips([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setExpandedKeys(new Set());
    setDetailsOpen(false);
  }, [filters]);

  function selectCandidateType(next: CandidateTypeSelection) {
    setCandidateType(next);
    setSelectedGrade("ALL");
    setSelectedClass("ALL");
  }

  function selectGrade(grade: string) {
    setSelectedGrade(grade);
    setSelectedClass("ALL");
  }

  function rowKey(row: FeeSummaryRow) {
    return `${row.candidateKey}-${row.registrationWindowId}-${row.statementNo ?? "none"}`;
  }

  function isRowExpanded(row: FeeSummaryRow) {
    return detailsOpen || expandedKeys.has(rowKey(row));
  }

  function toggleRow(row: FeeSummaryRow) {
    const key = rowKey(row);
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleDetailsMode() {
    setDetailsOpen((open) => {
      const next = !open;
      if (!next) setExpandedKeys(new Set());
      return next;
    });
  }

  function exportFile(format: "csv" | "xlsx", type: "summary" | "summary-details" = "summary") {
    window.location.href = `/api/fees/export?type=${type}&format=${format}&${filtersToParams(filters)}`;
  }

  const typeLabel = candidateType === "INTERNAL" ? "Internal" : "External";
  const classScopeTotal = byClass.reduce((sum, row) => sum + row.count, 0);
  const visibleTips = systemTips.filter((tip) => !dismissedTips.includes(tip));
  const showRegistrationFeeColumn = rows.some((row) => row.registrationFeeGbp != null);
  const colSpan =
    11 +
    (candidateType === "INTERNAL" ? 1 : 0) +
    (showRegistrationFeeColumn ? 1 : 0);

  return (
    <div className="space-y-6">
      <FeeManagementNav basePath={basePath} />
      <PageHeader
        title="Fee Summary"
        description="Per-student fee totals by registration window. Filter like Student Overview, then review subjects, registration fees, and payment status."
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: "INTERNAL", label: "Internal" },
            { value: "EXTERNAL", label: "External" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => selectCandidateType(option.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              candidateType === option.value
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Card className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <RegistrationWindowSelectorFields
              state={selector}
              layout="stacked"
              allowEmpty
              emptyOptionLabel="All registration windows"
              showStatus={false}
            />
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Grade
            <select
              value={selectedGrade}
              onChange={(e) => selectGrade(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            >
              <option value="ALL">All grades</option>
              {byGrade.map((bucket) => (
                <option key={bucket.key} value={bucket.key}>
                  {bucket.label} ({bucket.count})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Status
            <select
              value={statementStatus}
              onChange={(e) => setStatementStatus(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            >
              <option value="">All statement statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ISSUED">Issued</option>
              <option value="PAID">Paid</option>
              <option value="NEEDS_REGENERATION">Needs regeneration</option>
            </select>
          </label>
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
            Search
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setAppliedQ(q.trim());
              }}
              placeholder="Name, Chinese name, statement no…"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <button
            type="button"
            onClick={() => setAppliedQ(q.trim())}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Apply
          </button>
        </div>
      </Card>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Class
          {selectedGrade === "ALL"
            ? " (all grades)"
            : selectedGrade === "UNASSIGNED"
              ? " (unassigned grade)"
              : ` (${byGrade.find((row) => row.key === selectedGrade)?.label ?? selectedGrade})`}
        </p>
        {byClass.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            No classes in this selection.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedClass("ALL")}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                selectedClass === "ALL"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
              }`}
            >
              <span className="font-medium">All classes</span>
              <span className="ml-2 opacity-80">{classScopeTotal}</span>
            </button>
            {byClass.map((bucket) => (
              <button
                key={bucket.key}
                type="button"
                onClick={() => setSelectedClass(bucket.key)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  selectedClass === bucket.key
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:border-teal-300"
                }`}
              >
                <span className="font-medium">{bucket.label}</span>
                <span className="ml-2 opacity-80">{bucket.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {visibleTips.length > 0 ? (
        <div className="space-y-2">
          {visibleTips.map((tip) => (
            <TipBanner
              key={tip}
              text={tip}
              onDismiss={() => setDismissedTips((prev) => [...prev, tip])}
            />
          ))}
        </div>
      ) : null}

      {cards ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total Candidates" value={cards.totalCandidates} />
          <SummaryCard label="Total Exam Entries" value={cards.totalExamEntries} />
          <SummaryCard
            label="Total to collect"
            value={formatMoney(cards.totalGbpAmount, "GBP")}
            detail="Current fee totals for the students in this list"
          />
          <SummaryCard
            label="Paid total"
            value={formatMoney(cards.paidAmount, "GBP")}
            detail={
              cards.totalGbpAmount > 0
                ? `${Math.round((cards.paidAmount / cards.totalGbpAmount) * 1000) / 10}% of total`
                : undefined
            }
          />
          <SummaryCard
            label="Paid online"
            value={formatMoney(cards.paidOnlineGbp, "GBP")}
            detail={`${cards.paidOnlinePercent}% of total`}
          />
          <SummaryCard
            label="Paid offline"
            value={formatMoney(cards.paidOfflineGbp, "GBP")}
            detail={`${cards.paidOfflinePercent}% of total`}
          />
          <SummaryCard
            label="Unpaid"
            value={formatMoney(cards.unpaidAmount, "GBP")}
            detail="Total to collect minus paid"
          />
          <SummaryCard label="Missing Fee Rules" value={cards.missingFeeRules} />
          <SummaryCard label="Statements Generated" value={cards.statementsGenerated} />
          <SummaryCard label="Statements Not Generated" value={cards.statementsNotGenerated} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => exportFile("csv", "summary")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
        >
          Export summary CSV
        </button>
        <button
          type="button"
          onClick={() => exportFile("xlsx", "summary")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
        >
          Export summary Excel
        </button>
        <button
          type="button"
          onClick={() => exportFile("csv", "summary-details")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
        >
          Export details CSV
        </button>
        <button
          type="button"
          onClick={() => exportFile("xlsx", "summary-details")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
        >
          Export details Excel
        </button>
        <button
          type="button"
          onClick={toggleDetailsMode}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            detailsOpen
              ? "bg-indigo-700 text-white"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          {detailsOpen ? "Hide details" : "View details"}
        </button>
      </div>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="p-4 text-sm text-slate-600">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-600">
            No {typeLabel.toLowerCase()} fee data for current filters.
          </p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="w-10 px-3 py-3" />
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Type</th>
                {candidateType === "INTERNAL" ? (
                  <th className="px-4 py-3">Class</th>
                ) : null}
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Board</th>
                <th className="px-4 py-3">Series</th>
                <th className="px-4 py-3">Subjects</th>
                {showRegistrationFeeColumn ? (
                  <th className="px-4 py-3">Registration fee</th>
                ) : null}
                <th className="px-4 py-3">Amount due (GBP)</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Generated</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const key = rowKey(row);
                const expanded = isRowExpanded(row);
                const lines = row.lines ?? [];
                return (
                  <Fragment key={key}>
                    <tr className={expanded ? "bg-slate-50/80" : undefined}>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleRow(row)}
                          className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          aria-expanded={expanded}
                          aria-label={expanded ? "Collapse details" : "Expand details"}
                        >
                          {expanded ? "▾" : "▸"}
                        </button>
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-900">
                        {formatEnglishWithChineseName(row.englishName, row.chineseName)}
                      </td>
                      <td className="px-4 py-2">
                        {row.candidateType === "EXTERNAL" ? "External" : "Internal"}
                      </td>
                      {candidateType === "INTERNAL" ? (
                        <td className="px-4 py-2">{row.className?.trim() || "—"}</td>
                      ) : null}
                      <td className="px-4 py-2">{row.registrationWindowTitle}</td>
                      <td className="px-4 py-2">{row.examBoardName}</td>
                      <td className="px-4 py-2">{row.examSeriesName}</td>
                      <td className="px-4 py-2">{row.subjectCount}</td>
                      {showRegistrationFeeColumn ? (
                        <td className="px-4 py-2">
                          {row.registrationFeeGbp != null
                            ? formatMoney(row.registrationFeeGbp, "GBP")
                            : "—"}
                        </td>
                      ) : null}
                      <td className="px-4 py-2 font-medium">
                        {formatMoney(row.amountDueGbp, "GBP")}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${feeStatementStatusClass(row.statementStatus)}`}
                        >
                          {row.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-700">
                        {row.generatedAt ? new Date(row.generatedAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {row.systemMessages.length > 0 ? row.systemMessages.join(" · ") : "—"}
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="bg-white">
                        <td colSpan={colSpan} className="px-4 py-3">
                          {lines.length === 0 ? (
                            <p className="text-sm text-slate-500">No line items for this student.</p>
                          ) : (
                            <div className="overflow-hidden rounded-lg border border-slate-200">
                              <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2">Item</th>
                                    <th className="px-3 py-2">Type</th>
                                    <th className="px-3 py-2">Entry</th>
                                    <th className="px-3 py-2 text-right">Amount (GBP)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {lines.map((line, index) => (
                                    <tr key={`${key}-line-${index}`}>
                                      <td className="px-3 py-2 text-slate-900">{line.label}</td>
                                      <td className="px-3 py-2 text-slate-600">
                                        {line.kind === "REGISTRATION_FEE"
                                          ? "Registration fee"
                                          : "Exam"}
                                      </td>
                                      <td className="px-3 py-2 text-slate-600">
                                        {line.entryType ?? "—"}
                                      </td>
                                      <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900">
                                        {formatMoney(line.amountGbp, "GBP")}
                                      </td>
                                    </tr>
                                  ))}
                                  <tr className="bg-slate-50">
                                    <td
                                      colSpan={3}
                                      className="px-3 py-2 font-semibold text-slate-900"
                                    >
                                      Amount due
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                                      {formatMoney(row.amountDueGbp, "GBP")}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
