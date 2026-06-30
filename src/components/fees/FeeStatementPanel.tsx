"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  FeeStatementPrintButton,
  FeeStatementPrintModal,
  type FeeStatementPrintData,
} from "@/components/fees/FeeStatementPrintModal";
import { readJsonResponse } from "@/lib/client/fetch-json";
import { SalesAmountDisplay } from "@/components/fees/SalesAmountDisplay";
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

interface OutdatedStatementMeta {
  id: string;
  statementNo: string;
  status: string;
  generatedAt: string;
  regenerationReason?: string | null;
  regenerationChangedAt?: string | null;
  regenerationChangedBy?: { name: string } | null;
}

interface FeeStatementMeta {
  needsRegeneration: boolean;
  hasIssuedStatement: boolean;
  lastAdjustedAt: string | null;
  outdatedStatement?: OutdatedStatementMeta | null;
}

type StatementRow = FeeStatementPrintData & {
  regenerationReason?: string | null;
  regenerationChangedAt?: string | null;
  regenerationChangedBy?: { name: string } | null;
  generatedBy?: { name: string } | null;
  revisedFromStatement?: { statementNo: string } | null;
  revisedToStatement?: { statementNo: string } | null;
};

export function FeeStatementPanel({
  workspaceId,
  registrationWindowId,
  locked,
  feeRulesHref,
  refreshKey = 0,
  onStatusChange,
}: FeeStatementPanelProps) {
  const [statements, setStatements] = useState<StatementRow[]>([]);
  const [meta, setMeta] = useState<FeeStatementMeta>({
    needsRegeneration: false,
    hasIssuedStatement: false,
    lastAdjustedAt: null,
    outdatedStatement: null,
  });
  const [warnings, setWarnings] = useState<Array<{ subject: string; paperCode: string; paperTitle: string; entryType: string }>>([]);
  const [candidateRegistrationFeeWarning, setCandidateRegistrationFeeWarning] = useState<string | null>(null);
  const [candidateRegistrationFeePreview, setCandidateRegistrationFeePreview] = useState<{
    serviceName: string;
    salesGbp: number;
    salesCny: number;
    version: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<FeeStatementDisplayCurrencyOption>(
    DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
  );
  const [printOpen, setPrintOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/fee-statements?workspaceId=${workspaceId}&includeSuperseded=true`,
    );
    if (!response.ok) return;

    const data = await readJsonResponse<{
      statements?: StatementRow[];
      meta?: FeeStatementMeta;
    } | StatementRow[]>(response);

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

  const versionHistory = useMemo(
    () => [...statements].sort((a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime()),
    [statements],
  );

  const outdatedStatement = meta.outdatedStatement;
  const printable = statements.filter(
    (statement) =>
      selectedIds.includes(statement.id) && statement.status !== "NEEDS_REGENERATION",
  );

  async function validate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/fee-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", workspaceId }),
      });
      const data = await readJsonResponse<{
        error?: string;
        warnings?: typeof warnings;
        canGenerate?: boolean;
        candidateRegistrationFeeWarning?: string | null;
        candidateRegistrationFeePreview?: typeof candidateRegistrationFeePreview;
      }>(response);
      if (!response.ok) throw new Error(data.error ?? "Validation failed");
      setWarnings(data.warnings ?? []);
      setCandidateRegistrationFeeWarning(data.candidateRegistrationFeeWarning ?? null);
      setCandidateRegistrationFeePreview(data.candidateRegistrationFeePreview ?? null);
      if (data.canGenerate) {
        setMessage("All billable registration items have matching fee rules.");
      } else {
        const parts: string[] = [];
        if ((data.warnings?.length ?? 0) > 0) {
          parts.push(`missing fee rules for ${data.warnings?.length ?? 0} exam(s)`);
        }
        if (data.candidateRegistrationFeeWarning) {
          parts.push(data.candidateRegistrationFeeWarning);
        }
        setError(parts.join("; "));
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
        body: JSON.stringify(
          regenerate
            ? {
                action: "regenerate-revised",
                workspaceId,
                displayCurrency,
              }
            : {
                workspaceId,
                displayCurrency,
              },
        ),
      });
      const data = await readJsonResponse<{ error?: string; statementNo?: string; status?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Generation failed");
      setMessage(
        regenerate
          ? `Revised fee statement ${data.statementNo} generated and issued (${data.status}).`
          : `Fee statement ${data.statementNo} generated (${data.status}).`,
      );
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
            {meta.needsRegeneration ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void generate(true)}
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Regenerate Revised Statement
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={() => void generate(true)}
                className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
              >
                Regenerate revised
              </button>
            )}
            {outdatedStatement ? (
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                View Previous Statement
              </button>
            ) : null}
            {printable.length > 0 ? (
              <FeeStatementPrintButton onClick={() => setPrintOpen(true)} />
            ) : null}
          </div>
        </div>

        {meta.needsRegeneration && outdatedStatement ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-medium">⚠ Fee Statement Needs Regeneration</p>
            <p className="mt-1">
              Registration billing items have changed since this statement was generated. Please
              regenerate a revised statement before printing or sending it to the candidate.
            </p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-800">Statement Number</dt>
                <dd className="font-medium">{outdatedStatement.statementNo}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-800">Current Status</dt>
                <dd className="font-medium">{feeStatementStatusLabel(outdatedStatement.status)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-800">Generated Time</dt>
                <dd className="font-medium">{new Date(outdatedStatement.generatedAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-800">Changed Time</dt>
                <dd className="font-medium">
                  {outdatedStatement.regenerationChangedAt
                    ? new Date(outdatedStatement.regenerationChangedAt).toLocaleString()
                    : meta.lastAdjustedAt
                      ? new Date(meta.lastAdjustedAt).toLocaleString()
                      : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-800">Changed By</dt>
                <dd className="font-medium">
                  {outdatedStatement.regenerationChangedBy?.name ?? "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-amber-800">Change Reason</dt>
                <dd className="font-medium">
                  {outdatedStatement.regenerationReason ?? "Registration billing changed"}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p> : null}
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

        {candidateRegistrationFeePreview ? (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
            <p className="font-medium">Candidate Registration Fee included</p>
            <SalesAmountDisplay
              amounts={{
                salesGbp: candidateRegistrationFeePreview.salesGbp,
                salesCny: candidateRegistrationFeePreview.salesCny,
              }}
              displayCurrency={displayCurrency}
              className="mt-2"
            />
            <p className="mt-1 text-xs text-indigo-800">
              Fee schedule v{candidateRegistrationFeePreview.version}
            </p>
          </div>
        ) : null}

        {candidateRegistrationFeeWarning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">{candidateRegistrationFeeWarning}</p>
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Missing fee rules</p>
            <ul className="mt-2 list-disc pl-5">
              {warnings.map((w, i) => (
                <li key={i}>{w.subject} — {w.paperCode} {w.paperTitle} ({w.entryType})</li>
              ))}
            </ul>
            <a href={feeRulesHref} className="mt-2 inline-block text-indigo-700 underline">
              Configure fee rules
            </a>
          </div>
        ) : null}

        {statements.length === 0 ? (
          <p className="text-sm text-slate-500">No fee statements yet.</p>
        ) : (
          <div className="space-y-4">
            <ul className="divide-y divide-slate-100 text-sm">
              {statements
                .filter((statement) => statement.status !== "REVISED" || showHistory)
                .slice()
                .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
                .map((statement) => (
                  <li key={statement.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(statement.id)}
                        disabled={statement.status === "NEEDS_REGENERATION"}
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
                        {statement.generatedBy?.name ? ` · ${statement.generatedBy.name}` : ""}
                      </span>
                    </label>
                    <div className="flex gap-2">
                      {statement.status === "DRAFT" ? (
                        <button type="button" disabled={loading} onClick={() => void issue(statement.id)} className="text-indigo-600 disabled:text-slate-400">
                          Issue
                        </button>
                      ) : null}
                      {statement.status === "NEEDS_REGENERATION" ? (
                        <span className="text-xs text-amber-800">Outdated — regenerate required</span>
                      ) : (
                        <button
                          type="button"
                          disabled={statement.status === "NEEDS_REGENERATION"}
                          onClick={() => {
                            setSelectedIds([statement.id]);
                            setPrintOpen(true);
                          }}
                          className="text-slate-600 disabled:text-slate-300"
                        >
                          Print
                        </button>
                      )}
                    </div>
                  </li>
                ))}
            </ul>

            {versionHistory.length > 1 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">Version history</h3>
                  <button
                    type="button"
                    onClick={() => setShowHistory((value) => !value)}
                    className="text-xs font-medium text-indigo-700 hover:text-indigo-800"
                  >
                    {showHistory ? "Hide revised versions" : "Show all versions"}
                  </button>
                </div>
                {showHistory ? (
                  <ol className="mt-3 space-y-3">
                    {versionHistory.map((statement) => (
                      <li key={statement.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-slate-900">{statement.statementNo}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${feeStatementStatusClass(statement.status)}`}>
                            {feeStatementStatusLabel(statement.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          Generated {new Date(statement.generatedAt).toLocaleString()}
                          {statement.generatedBy?.name ? ` · ${statement.generatedBy.name}` : ""}
                        </p>
                        {statement.regenerationReason ? (
                          <p className="mt-1 text-xs text-slate-600">Reason: {statement.regenerationReason}</p>
                        ) : null}
                        {statement.revisedToStatement ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Replaced by {statement.revisedToStatement.statementNo}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            ) : null}
          </div>
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
