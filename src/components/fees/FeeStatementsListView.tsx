"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { FeeManagementNav } from "@/components/fees/FeeManagementNav";
import { formatMoney } from "@/lib/fees/money";
import { readJsonResponse } from "@/lib/client/fetch-json";
import { DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY } from "@/lib/fees/display-currency";

interface FeeStatementsListViewProps {
  basePath: "/admin" | "/exam-office";
  windowsBasePath: string;
}

interface StatementRow {
  id: string;
  statementNo: string;
  studentNameSnapshot: string;
  status: string;
  totalGbpAmount: number | string;
  totalCnyAmount: number | string;
  generatedAt: string;
  registrationWindow: { title: string };
}

interface WindowStatus {
  lockedWorkspaces: number;
  totalWorkspaces: number;
  feeRules: number;
  statements: number;
  canGenerate: boolean;
  blockers: string[];
  window: {
    title: string;
    examBoard: { code: string };
    examSeries: { name: string; year: number };
  };
}

export function FeeStatementsListView({
  basePath,
  windowsBasePath,
}: FeeStatementsListViewProps) {
  const searchParams = useSearchParams();
  const [statements, setStatements] = useState<StatementRow[]>([]);
  const [windowId, setWindowId] = useState("");
  const [windows, setWindows] = useState<Array<{ id: string; title: string }>>([]);
  const [status, setStatus] = useState<WindowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/registration-windows")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setWindows(Array.isArray(data) ? data : []))
      .catch(() => setWindows([]));
  }, []);

  useEffect(() => {
    const fromUrl = searchParams.get("registrationWindowId");
    if (fromUrl) setWindowId(fromUrl);
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!windowId) {
      setStatements([]);
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [statementsRes, statusRes] = await Promise.all([
        fetch(`/api/fee-statements?registrationWindowId=${windowId}`),
        fetch(`/api/registration-windows/${windowId}/fee-statement-status`),
      ]);

      const statementsData = statementsRes.ok ? await statementsRes.json() : [];
      setStatements(Array.isArray(statementsData) ? statementsData : []);

      if (statusRes.ok) {
        setStatus(await statusRes.json());
      } else {
        setStatus(null);
      }
    } catch {
      setStatements([]);
      setStatus(null);
      setError("Failed to load fee statements");
    } finally {
      setLoading(false);
    }
  }, [windowId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function batchGenerate(issue: boolean) {
    if (!windowId) return;
    setGenerating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/fee-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch",
          registrationWindowId: windowId,
          displayCurrency: DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const feeRulesHref = `${windowsBasePath}/${windowId}/fees`;

  return (
    <div className="space-y-6">
      <FeeManagementNav basePath={basePath} />
      <PageHeader
        title="Fee Statements"
        description="Generate and view fee statements for locked registrations in a registration window."
      />
      <Card className="space-y-4">
        <select
          value={windowId}
          onChange={(e) => setWindowId(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select registration window</option>
          {windows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </select>

        {windowId && status ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p>
              <span className="font-medium">{status.window.title}</span>
              {" · "}
              {status.window.examBoard.code} · {status.window.examSeries.name} (
              {status.window.examSeries.year})
            </p>
            <p className="mt-1">
              {status.lockedWorkspaces} locked workspace{status.lockedWorkspaces === 1 ? "" : "s"}
              {" · "}
              {status.feeRules} active fee rule{status.feeRules === 1 ? "" : "s"}
              {" · "}
              {status.statements} statement{status.statements === 1 ? "" : "s"}
            </p>
            {status.blockers.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
                {status.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {windowId ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={generating || !status?.canGenerate}
              onClick={() => void batchGenerate(false)}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate all (draft)
            </button>
            <button
              type="button"
              disabled={generating || !status?.canGenerate}
              onClick={() => void batchGenerate(true)}
              className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate & issue all
            </button>
            <Link
              href={feeRulesHref}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Fee rules
            </Link>
            <Link
              href={`${basePath}/registrations`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Registrations
            </Link>
            {statements.length > 0 ? (
              <Link
                href={`${basePath}/fee-statements/batch-print?registrationWindowId=${windowId}`}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batch print
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Select a registration window to generate or view fee statements.
          </p>
        )}

        {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p> : null}
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      </Card>

      <Card className="overflow-x-auto p-0">
        {!windowId ? (
          <p className="p-4 text-sm text-slate-600">Select a registration window to view statements.</p>
        ) : loading ? (
          <p className="p-4 text-sm text-slate-600">Loading...</p>
        ) : statements.length === 0 ? (
          <div className="space-y-2 p-4 text-sm text-slate-600">
            <p>No fee statements found for this window yet.</p>
            {status?.canGenerate ? (
              <p>
                Fee rules and locked registrations are ready. Click{" "}
                <span className="font-medium">Generate all (draft)</span> above to create statements.
              </p>
            ) : (
              <p>
                Configure{" "}
                <Link href={feeRulesHref} className="text-indigo-600 hover:underline">
                  fee rules
                </Link>{" "}
                and ensure registrations are locked, then generate statements here.
              </p>
            )}
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Statement No.</th>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total GBP</th>
                <th className="px-4 py-3">Total CNY</th>
                <th className="px-4 py-3">Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {statements.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2">{row.statementNo}</td>
                  <td className="px-4 py-2">{row.studentNameSnapshot}</td>
                  <td className="px-4 py-2">{row.registrationWindow.title}</td>
                  <td className="px-4 py-2">{row.status}</td>
                  <td className="px-4 py-2">{formatMoney(Number(row.totalGbpAmount), "GBP")}</td>
                  <td className="px-4 py-2">{formatMoney(Number(row.totalCnyAmount), "CNY")}</td>
                  <td className="px-4 py-2">{new Date(row.generatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
