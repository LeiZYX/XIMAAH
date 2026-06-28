"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  FeeStatementPrintModal,
  type FeeStatementPrintData,
} from "@/components/fees/FeeStatementPrintModal";
import { readJsonResponse } from "@/lib/client/fetch-json";
import {
  DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
  type FeeStatementDisplayCurrencyOption,
} from "@/lib/fees/display-currency";

interface FeeStatementsBatchPanelProps {
  registrationWindowId: string;
  feeRulesHref: string;
}

export function FeeStatementsBatchPanel({
  registrationWindowId,
  feeRulesHref,
}: FeeStatementsBatchPanelProps) {
  const [statements, setStatements] = useState<FeeStatementPrintData[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<FeeStatementDisplayCurrencyOption>(
    DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
  );
  const [printOpen, setPrintOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/fee-statements?registrationWindowId=${registrationWindowId}`,
    );
    if (response.ok) {
      setStatements(await readJsonResponse<FeeStatementPrintData[]>(response));
    }
  }, [registrationWindowId]);

  useEffect(() => {
    load();
  }, [load]);

  async function batchGenerate(issue: boolean) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/fee-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch",
          registrationWindowId,
          displayCurrency,
          issue,
        }),
      });
      const data = await readJsonResponse<{
        error?: string;
        results?: Array<{ ok: boolean; error?: string; skipped?: boolean }>;
      }>(response);
      if (!response.ok) throw new Error(data.error ?? "Batch generation failed");
      const results = data.results ?? [];
      const okCount = results.filter((r) => r.ok).length;
      const skippedCount = results.filter((r) => r.ok && r.skipped).length;
      const failCount = results.length - okCount;
      setMessage(
        `Generated ${okCount} statement(s).${
          skippedCount ? ` ${skippedCount} already had drafts.` : ""
        }${failCount ? ` ${failCount} failed.` : ""}`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch generation failed");
    } finally {
      setLoading(false);
    }
  }

  const printable = statements.filter((s) => selectedIds.includes(s.id));

  return (
    <>
      <Card className="space-y-4">
        <PageHeader
          title="Fee statement batch actions"
          description="Generate and print fee statements for all locked registrations in a registration window."
        />
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
            disabled={loading || !registrationWindowId}
            onClick={() => void batchGenerate(false)}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Batch generate (draft)
          </button>
          <button
            type="button"
            disabled={loading || !registrationWindowId}
            onClick={() => void batchGenerate(true)}
            className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-700 disabled:opacity-50"
          >
            Batch generate & issue
          </button>
          <button
            type="button"
            disabled={printable.length === 0}
            onClick={() => setPrintOpen(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            Batch print selected
          </button>
          <a href={feeRulesHref} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Fee rules
          </a>
        </div>
        {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p> : null}
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

        {statements.length > 0 ? (
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
        ) : null}
      </Card>

      {printOpen && printable.length > 0 ? (
        <FeeStatementPrintModal
          statements={printable}
          displayCurrency={displayCurrency}
          onClose={() => setPrintOpen(false)}
        />
      ) : null}
    </>
  );
}
