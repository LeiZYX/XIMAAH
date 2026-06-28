"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  FeeStatementPrintButton,
  FeeStatementPrintModal,
  type FeeStatementPrintData,
} from "@/components/fees/FeeStatementPrintModal";
import { readJsonResponse } from "@/lib/client/fetch-json";
import {
  DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
  type FeeStatementDisplayCurrencyOption,
} from "@/lib/fees/display-currency";
import {
  feeStatementStatusClass,
  feeStatementStatusLabel,
} from "@/lib/fees/workspace-status";

interface FeeStatementPanelProps {
  workspaceId: string;
  registrationWindowId: string;
  locked: boolean;
  feeRulesHref: string;
  refreshKey?: number;
  onStatusChange?: (meta: {
    needsRegeneration: boolean;
    hasIssuedStatement: boolean;
  }) => void;
}

interface FeeStatementMeta {
  needsRegeneration: boolean;
  hasIssuedStatement: boolean;
  lastAdjustedAt: string | null;
}

export function FeeStatementPanel({
  workspaceId,
  registrationWindowId,
  locked,
  feeRulesHref,
  refreshKey = 0,
  onStatusChange,
}: FeeStatementPanelProps) {
  const [statements, setStatements] = useState<FeeStatementPrintData[]>([]);
  const [meta, setMeta] = useState<FeeStatementMeta>({
    needsRegeneration: false,
    hasIssuedStatement: false,
    lastAdjustedAt: null,
  });
  const [warnings, setWarnings] = useState<Array<{ subject: string; paperCode: string; paperTitle: string; entryType: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<FeeStatementDisplayCurrencyOption>(
    DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
  );
  const [printOpen, setPrintOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    const response = await fetch(`/api/fee-statements?workspaceId=${workspaceId}`);
    if (!response.ok) return;

    const data = await readJsonResponse<{
      statements?: FeeStatementPrintData[];
      meta?: FeeStatementMeta;
    } | FeeStatementPrintData[]>(response);

    if (Array.isArray(data)) {
      setStatements(data);
      return;
    }

    setStatements(data.statements ?? []);
    if (data.meta) {
      setMeta(data.meta);
      onStatusChange?.({
        needsRegeneration: data.meta.needsRegeneration,
        hasIssuedStatement: data.meta.hasIssuedStatement,
      });
    }
  }, [workspaceId, onStatusChange]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function validate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/fee-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", workspaceId }),
      });
      const data = await readJsonResponse<{ error?: string; warnings?: typeof warnings; canGenerate?: boolean }>(response);
      if (!response.ok) throw new Error(data.error ?? "Validation failed");
      setWarnings(data.warnings ?? []);
      if (data.canGenerate) {
        setMessage("All registered exams have matching fee rules.");
      } else {
        setError(`Missing fee rules for ${data.warnings?.length ?? 0} exam(s).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  }

  async function generate(regenerate = false) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/fee-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          displayCurrency,
          regenerate,
        }),
      });
      const data = await readJsonResponse<{ error?: string; statementNo?: string; status?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Generation failed");
      setMessage(`Fee statement ${data.statementNo} generated (${data.status}).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function issue(statementId: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/fee-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "issue", statementId }),
      });
      const data = await readJsonResponse<{ error?: string; statementNo?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Issue failed");
      setMessage(`Statement ${data.statementNo} issued.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Issue failed");
    } finally {
      setLoading(false);
    }
  }

  const printable = statements.filter((s) => selectedIds.includes(s.id));

  if (!locked) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Fee statements</h2>
        <p className="mt-2 text-sm text-slate-600">Fee statements can be generated after registrations are locked.</p>
      </Card>
    );
  }

  return (
    <>
      <div id="fee-statements-panel">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Fee statements</h2>
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
            <button type="button" disabled={loading} onClick={() => void validate()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Check fee rules
            </button>
            {!meta.needsRegeneration ? (
              <button type="button" disabled={loading} onClick={() => void generate(false)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                Generate statement
              </button>
            ) : null}
            <button
              type="button"
              disabled={loading}
              onClick={() => void generate(true)}
              className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                meta.needsRegeneration
                  ? "bg-amber-600 text-white hover:bg-amber-700"
                  : "border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              }`}
            >
              Regenerate revised
            </button>
            {printable.length > 0 ? (
              <FeeStatementPrintButton onClick={() => setPrintOpen(true)} />
            ) : null}
          </div>
        </div>

        {meta.needsRegeneration ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-medium">Fee statement is out of date</p>
            <p className="mt-1">
              Exam subjects were changed after the last fee statement was generated
              {meta.lastAdjustedAt ? ` (${new Date(meta.lastAdjustedAt).toLocaleString()})` : ""}.
              Previously issued statements have been marked as superseded. Use{" "}
              <strong>Regenerate revised</strong> to create an updated statement, then issue it again.
            </p>
          </div>
        ) : null}

        {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p> : null}
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

        {warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Missing fee rules</p>
            <ul className="mt-2 list-disc pl-5">
              {warnings.map((w, i) => (
                <li key={i}>{w.subject} — {w.paperCode} {w.paperTitle} ({w.entryType})</li>
              ))}
            </ul>
            <a
              href={feeRulesHref}
              className="mt-2 inline-block text-indigo-700 underline"
            >
              Configure fee rules
            </a>
          </div>
        ) : null}

        {statements.length === 0 ? (
          <p className="text-sm text-slate-500">No fee statements yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {statements.map((statement) => (
              <li key={statement.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <label className="flex items-center gap-2">
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
                    <span className="font-medium text-slate-900">{statement.statementNo}</span>
                    {" · "}
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${feeStatementStatusClass(statement.status)}`}>
                      {feeStatementStatusLabel(statement.status)}
                    </span>
                    {" · "}
                    Generated {new Date(statement.generatedAt).toLocaleString()}
                  </span>
                </label>
                <div className="flex gap-2">
                  {statement.status === "DRAFT" || statement.status === "NEEDS_REVIEW" ? (
                    <button type="button" disabled={loading || statement.status === "NEEDS_REVIEW"} onClick={() => void issue(statement.id)} className="text-indigo-600 disabled:text-slate-400" title={statement.status === "NEEDS_REVIEW" ? "Regenerate before issuing" : undefined}>
                      Issue
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIds([statement.id]);
                      setPrintOpen(true);
                    }}
                    className="text-slate-600"
                  >
                    Print
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </div>

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
