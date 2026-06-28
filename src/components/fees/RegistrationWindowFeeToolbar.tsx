"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { FeeStatementsBatchPanel } from "@/components/fees/FeeStatementsBatchPanel";
import { readJsonResponse } from "@/lib/client/fetch-json";
import { DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY } from "@/lib/fees/display-currency";

interface RegistrationWindowFeeToolbarProps {
  windowId: string;
  basePath: "/admin" | "/exam-office";
  feeRulesHref: string;
}

export function RegistrationWindowFeeToolbar({
  windowId,
  basePath,
  feeRulesHref,
}: RegistrationWindowFeeToolbarProps) {
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function batchGenerate(issue: boolean, regenerate: boolean) {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/fee-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch",
          registrationWindowId: windowId,
          displayCurrency: DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
          issue,
          regenerate,
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
      const failMessages = results
        .filter((r) => !r.ok)
        .map((r) => r.error)
        .filter(Boolean)
        .slice(0, 3);
      setMessage(
        `Generated ${okCount} statement(s).${
          skippedCount ? ` ${skippedCount} already had drafts.` : ""
        }${failCount ? ` ${failCount} failed.` : ""}${
          failMessages.length ? ` ${failMessages.join("; ")}` : ""
        }`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch generation failed");
    } finally {
      setLoading(false);
    }
  }

  const summaryHref = `${basePath}/fee-summary?registrationWindowId=${windowId}`;
  const detailsHref = `${basePath}/fee-details?registrationWindowId=${windowId}`;
  const batchPrintHref = `${basePath}/fee-statements/batch-print?registrationWindowId=${windowId}`;
  const statementsHref = `${basePath}/fee-statements?registrationWindowId=${windowId}`;

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Fee statement actions</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void batchGenerate(false, false)}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Generate all (draft)
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void batchGenerate(true, false)}
          className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-700 disabled:opacity-50"
        >
          Generate & issue all
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void batchGenerate(true, true)}
          className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800 disabled:opacity-50"
        >
          Regenerate revised
        </button>
        <Link href={summaryHref} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          View fee summary
        </Link>
        <Link href={detailsHref} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          View fee details
        </Link>
        <Link href={statementsHref} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          View fee statements
        </Link>
        <a
          href={`/api/fees/export?type=summary&format=xlsx&registrationWindowId=${windowId}`}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Export summary
        </a>
        <a
          href={`/api/fees/export?type=details&format=xlsx&registrationWindowId=${windowId}`}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Export details
        </a>
        <Link href={batchPrintHref} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Batch print
        </Link>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
        >
          {expanded ? "Hide batch panel" : "Show batch panel"}
        </button>
      </div>
      {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p> : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {expanded ? (
        <FeeStatementsBatchPanel
          registrationWindowId={windowId}
          feeRulesHref={feeRulesHref}
        />
      ) : null}
    </Card>
  );
}
