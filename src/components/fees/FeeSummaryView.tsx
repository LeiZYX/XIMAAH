"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { FeeManagementNav } from "@/components/fees/FeeManagementNav";
import {
  FeeReportFiltersForm,
  filtersToParams,
} from "@/components/fees/FeeReportFiltersForm";
import type { FeeReportFilters } from "@/lib/fees/filters";
import type { FeeSummaryCards, FeeSummaryRow } from "@/lib/fees/reporting";
import { formatMoney } from "@/lib/fees/money";

interface FeeSummaryViewProps {
  basePath: "/admin" | "/exam-office";
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </Card>
  );
}

export function FeeSummaryView({ basePath }: FeeSummaryViewProps) {
  const [filters, setFilters] = useState<FeeReportFilters>({});
  const [cards, setCards] = useState<FeeSummaryCards | null>(null);
  const [rows, setRows] = useState<FeeSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/fees/summary?${filtersToParams(filters)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load summary");
      setCards(data.cards);
      setRows(data.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summary");
      setCards(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  function exportFile(format: "csv" | "xlsx") {
    window.location.href = `/api/fees/export?type=summary&format=${format}&${filtersToParams(filters)}`;
  }

  return (
    <div className="space-y-6">
      <FeeManagementNav basePath={basePath} />
      <PageHeader
        title="Fee Summary"
        description="Aggregated fee totals by registration window, grade, class, and subject."
      />
      <Card className="space-y-4">
        <FeeReportFiltersForm
          filters={filters}
          onChange={setFilters}
          onSearch={() => void load()}
          showBatchOptions
        />
      </Card>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {cards ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard label="Total Candidates" value={cards.totalCandidates} />
          <SummaryCard label="Total Exam Entries" value={cards.totalExamEntries} />
          <SummaryCard label="Total GBP" value={formatMoney(cards.totalGbpAmount, "GBP")} />
          <SummaryCard label="Total CNY" value={formatMoney(cards.totalCnyAmount, "CNY")} />
          <SummaryCard label="Paid Amount" value={formatMoney(cards.paidAmount, "GBP")} />
          <SummaryCard label="Unpaid Amount" value={formatMoney(cards.unpaidAmount, "GBP")} />
          <SummaryCard label="Missing Fee Rules" value={cards.missingFeeRules} />
          <SummaryCard label="Statements Generated" value={cards.statementsGenerated} />
          <SummaryCard label="Statements Not Generated" value={cards.statementsNotGenerated} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => exportFile("csv")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
        >
          Export summary CSV
        </button>
        <button
          type="button"
          onClick={() => exportFile("xlsx")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
        >
          Export summary Excel
        </button>
        <Link
          href={`${basePath}/fee-details?${filtersToParams(filters)}`}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
        >
          View details
        </Link>
      </div>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="p-4 text-sm text-slate-600">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-600">No fee data for current filters.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Board</th>
                <th className="px-4 py-3">Series</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Candidates</th>
                <th className="px-4 py-3">Entries</th>
                <th className="px-4 py-3">GBP</th>
                <th className="px-4 py-3">CNY</th>
                <th className="px-4 py-3">Missing rules</th>
                <th className="px-4 py-3">Statements</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="px-4 py-2">{row.registrationWindowTitle}</td>
                  <td className="px-4 py-2">{row.examBoardName}</td>
                  <td className="px-4 py-2">{row.examSeriesName}</td>
                  <td className="px-4 py-2">{row.grade}</td>
                  <td className="px-4 py-2">{row.className}</td>
                  <td className="px-4 py-2">{row.candidateType}</td>
                  <td className="px-4 py-2">{row.subjectName}</td>
                  <td className="px-4 py-2">{row.candidateCount}</td>
                  <td className="px-4 py-2">{row.examEntryCount}</td>
                  <td className="px-4 py-2">{formatMoney(row.totalGbp, "GBP")}</td>
                  <td className="px-4 py-2">{formatMoney(row.totalCny, "CNY")}</td>
                  <td className="px-4 py-2">{row.missingFeeRuleCount}</td>
                  <td className="px-4 py-2">{row.statementCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
