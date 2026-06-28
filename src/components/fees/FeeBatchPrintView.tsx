"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { FeeManagementNav } from "@/components/fees/FeeManagementNav";
import {
  FeeReportFiltersForm,
  filtersToParams,
} from "@/components/fees/FeeReportFiltersForm";
import {
  FeeStatementPrintModal,
  type FeeStatementPrintData,
} from "@/components/fees/FeeStatementPrintModal";
import type { FeeReportFilters } from "@/lib/fees/filters";
import {
  DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
  type FeeStatementDisplayCurrencyOption,
} from "@/lib/fees/display-currency";

interface FeeBatchPrintViewProps {
  basePath: "/admin" | "/exam-office";
}

export function FeeBatchPrintView({ basePath }: FeeBatchPrintViewProps) {
  const [filters, setFilters] = useState<FeeReportFilters>({
    includeExternal: true,
    includeOfficeOnly: false,
    includeManualReview: false,
  });
  const [statements, setStatements] = useState<FeeStatementPrintData[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState<FeeStatementDisplayCurrencyOption>(
    DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
  );
  const [printOpen, setPrintOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = filtersToParams(filters);
    const windowId = filters.registrationWindowId;
    if (!windowId) {
      setStatements([]);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/fee-statements?registrationWindowId=${windowId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load statements");
      let list: FeeStatementPrintData[] = Array.isArray(data) ? data : [];

      if (filters.statementStatus) {
        list = list.filter((s) => s.status === filters.statementStatus);
      }
      if (filters.grade) {
        list = list.filter((s) => s.gradeSnapshot === filters.grade);
      }
      if (filters.className) {
        list = list.filter((s) => s.classNameSnapshot === filters.className);
      }
      if (filters.candidateType) {
        list = list.filter((s) => s.candidateTypeSnapshot === filters.candidateType);
      }
      if (filters.includeExternal === false) {
        list = list.filter((s) => s.candidateTypeSnapshot !== "EXTERNAL");
      }

      setStatements(list);
      setSelectedIds(list.map((s) => s.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setStatements([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const printable = statements.filter((s) => selectedIds.includes(s.id));

  return (
    <div className="space-y-6">
      <FeeManagementNav basePath={basePath} />
      <PageHeader
        title="Batch Print Fee Statements"
        description="Print fee statements for multiple candidates. One statement per candidate with page breaks."
      />

      <Card className="space-y-4">
        <FeeReportFiltersForm
          filters={filters}
          onChange={setFilters}
          onSearch={() => void load()}
          showBatchOptions
        />
        <p className="text-sm text-slate-600">
          Select a registration window to load statements. Use filters to narrow the list.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value as FeeStatementDisplayCurrencyOption)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="GBP">Display GBP</option>
            <option value="CNY">Display CNY</option>
            <option value="BOTH">Display GBP + CNY</option>
          </select>
          <button
            type="button"
            disabled={printable.length === 0}
            onClick={() => setPrintOpen(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Batch print ({printable.length})
          </button>
        </div>
      </Card>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <Card>
        {loading ? (
          <p className="text-sm text-slate-600">Loading...</p>
        ) : statements.length === 0 ? (
          <p className="text-sm text-slate-600">No statements match filters.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {statements.map((statement) => (
              <li key={statement.id} className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(statement.id)}
                  onChange={(e) => {
                    setSelectedIds((prev) =>
                      e.target.checked
                        ? [...prev, statement.id]
                        : prev.filter((id) => id !== statement.id),
                    );
                  }}
                />
                <span>
                  {statement.statementNo} · {statement.studentNameSnapshot} · {statement.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {printOpen && printable.length > 0 ? (
        <FeeStatementPrintModal
          statements={printable}
          displayCurrency={displayCurrency}
          onClose={() => setPrintOpen(false)}
        />
      ) : null}
    </div>
  );
}
