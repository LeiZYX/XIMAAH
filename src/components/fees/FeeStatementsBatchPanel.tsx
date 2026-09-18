"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  FeeStatementPrintModal,
  type FeeStatementPrintData,
} from "@/components/fees/FeeStatementPrintModal";
import { StatementPaymentOrdersPanel } from "@/components/fees/StatementPaymentOrdersPanel";
import { formatEnglishWithChineseName } from "@/lib/candidates/identity";
import { readJsonResponse } from "@/lib/client/fetch-json";
import {
  DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
  type FeeStatementDisplayCurrencyOption,
} from "@/lib/fees/display-currency";
import {
  feePaymentPaidClass,
  feePaymentPaidLabel,
} from "@/lib/fees/payment-settlement";
import { LIST_PAGE_SIZES } from "@/lib/pagination";
import {
  feeStatementStatusClass,
  feeStatementStatusLabel,
} from "@/lib/fees/workspace-status";

interface FeeStatementsBatchPanelProps {
  registrationWindowId: string;
  feeRulesHref: string;
}

interface PaginatedStatements {
  statements: FeeStatementPrintData[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

function IconActionButton({
  label,
  onClick,
  disabled,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "primary" | "warning" | "danger" | "success";
  children: ReactNode;
}) {
  const toneClass =
    tone === "primary"
      ? "text-indigo-700 ring-indigo-200 hover:bg-indigo-50"
      : tone === "warning"
        ? "text-amber-800 ring-amber-200 hover:bg-amber-50"
        : tone === "danger"
          ? "text-red-700 ring-red-200 hover:bg-red-50"
          : tone === "success"
            ? "text-green-800 ring-green-200 hover:bg-green-50"
            : "text-slate-700 ring-slate-200 hover:bg-slate-50";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset disabled:opacity-50 ${toneClass}`}
    >
      {children}
    </button>
  );
}

function statementCandidateLabel(statement: FeeStatementPrintData) {
  return formatEnglishWithChineseName(
    statement.studentNameSnapshot,
    statement.candidate?.chineseName,
  );
}

function ActionIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function FeeStatementsBatchPanel({
  registrationWindowId,
  feeRulesHref,
}: FeeStatementsBatchPanelProps) {
  const [statements, setStatements] = useState<FeeStatementPrintData[]>([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<FeeStatementDisplayCurrencyOption>(
    DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [batchPrintOpen, setBatchPrintOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [previewStatement, setPreviewStatement] = useState<{
    statement: FeeStatementPrintData;
    autoPrint: boolean;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [registrationWindowId, paymentFilter, search]);

  const load = useCallback(async () => {
    if (!registrationWindowId) {
      setStatements([]);
      setTotal(0);
      setTotalPages(0);
      return;
    }
    setListLoading(true);
    try {
      const params = new URLSearchParams({
        registrationWindowId,
        page: String(page),
        pageSize: String(pageSize),
        statementKind: "NORMAL",
      });
      if (paymentFilter !== "all") {
        params.set("paymentStatus", paymentFilter);
      }
      if (search) {
        params.set("q", search);
      }
      const response = await fetch(`/api/fee-statements?${params.toString()}`);
      const data = await readJsonResponse<PaginatedStatements>(response);
      if (response.ok && data.statements) {
        setStatements(data.statements);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setSelectedIds((prev) => prev.filter((id) => data.statements.some((s) => s.id === id)));
      } else {
        setStatements([]);
        setTotal(0);
        setTotalPages(0);
      }
    } catch {
      setStatements([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setListLoading(false);
    }
  }, [registrationWindowId, page, pageSize, paymentFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function issueStatement(statementId: string) {
    setLoading(true);
    setError(null);
    setMessage(null);
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

  async function regenerateStatement(statement: FeeStatementPrintData) {
    const workspaceId = statement.registrationWorkspaceId;
    if (!workspaceId) {
      setError("This statement has no registration workspace; cannot regenerate.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/fee-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "regenerate-revised",
          workspaceId,
          displayCurrency: statement.displayCurrency ?? displayCurrency,
        }),
      });
      const data = await readJsonResponse<{
        error?: string;
        statementNo?: string;
        status?: string;
      }>(response);
      if (!response.ok) throw new Error(data.error ?? "Regenerate failed");
      setMessage(
        `Revised fee statement ${data.statementNo} generated and issued (${data.status}).`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regenerate failed");
    } finally {
      setLoading(false);
    }
  }

  async function repriceStatement(statement: FeeStatementPrintData) {
    const workspaceId = statement.registrationWorkspaceId;
    if (!workspaceId) {
      setError("This statement has no registration workspace; cannot reprice.");
      return;
    }
    const confirmed = window.confirm(
      [
        `Reprice ${statement.statementNo} (${statementCandidateLabel(statement)}) using current fee-stage windows?`,
        "",
        "This will:",
        "1) Re-evaluate Normal / Late / High Late from the registration window’s fee-stage dates (as of now)",
        "2) Update entry stages on this registration (manual overrides are skipped)",
        "3) Regenerate and issue a revised fee statement",
        "",
        "Use Regenerate if you only want to refresh prices without changing stages.",
      ].join("\n"),
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/fee-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reprice-by-current-fee-stage",
          workspaceId,
          displayCurrency: statement.displayCurrency ?? displayCurrency,
        }),
      });
      const data = await readJsonResponse<{
        error?: string;
        statement?: { statementNo?: string; status?: string };
        targetStageLabel?: string;
        changes?: Array<{ paperCode: string | null }>;
        skippedOverridden?: Array<{ paperCode: string | null }>;
      }>(response);
      if (!response.ok) throw new Error(data.error ?? "Reprice failed");
      const changedCount = data.changes?.length ?? 0;
      const skippedCount = data.skippedOverridden?.length ?? 0;
      setMessage(
        `Repriced ${statementCandidateLabel(statement)} → ${data.targetStageLabel ?? "current stage"}; statement ${
          data.statement?.statementNo ?? ""
        } issued (${data.statement?.status ?? ""}). ${changedCount} exam stage update(s)${
          skippedCount ? `; ${skippedCount} manual override(s) skipped` : ""
        }.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reprice failed");
    } finally {
      setLoading(false);
    }
  }

  async function markStatementPaidOffline(statement: FeeStatementPrintData) {
    if (statement.status !== "ISSUED") {
      setError("Only Issued statements can be marked paid offline.");
      return;
    }
    const confirmed = window.confirm(
      [
        `Mark ${statement.statementNo} (${statementCandidateLabel(statement)}) as paid offline?`,
        "",
        "Use this when payment was received outside WeChat/Alipay QR.",
        "Open online payment orders for this statement will be closed.",
        "This action is audited.",
      ].join("\n"),
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/fee-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark-paid-offline",
          statementId: statement.id,
        }),
      });
      const data = await readJsonResponse<{
        error?: string;
        statementNo?: string;
        alreadyPaid?: boolean;
        paymentSettlement?: string;
      }>(response);
      if (!response.ok) throw new Error(data.error ?? "Mark paid failed");
      setMessage(
        data.alreadyPaid
          ? `Statement ${data.statementNo} was already paid.`
          : `Statement ${data.statementNo} marked paid offline (${data.paymentSettlement ?? "OFFLINE"}).`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mark paid failed");
    } finally {
      setLoading(false);
    }
  }

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
      const createdCount = results.filter((r) => r.ok && !r.skipped).length;
      const skippedCount = results.filter((r) => r.ok && r.skipped).length;
      const failCount = results.filter((r) => !r.ok).length;
      const failMessages = results
        .filter((r) => !r.ok)
        .map((r) => r.error)
        .filter(Boolean)
        .slice(0, 2);
      setMessage(
        `Processed ${results.length} workspace(s): ${createdCount} created/issued.${
          skippedCount ? ` ${skippedCount} skipped.` : ""
        }${failCount ? ` ${failCount} failed.` : ""}${
          failMessages.length ? ` ${failMessages.join("; ")}` : ""
        }`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function batchRepriceByCurrentFeeStage() {
    const confirmed = window.confirm(
      [
        "Batch reprice using current fee-stage windows?",
        "",
        "This will process all locked internal-normal registrations in this window:",
        "1) Re-evaluate Normal / Late / High Late from the window’s fee-stage dates (as of now)",
        "2) Update entry stages (manual overrides are skipped)",
        "3) Regenerate and issue a revised fee statement for each",
        "",
        "Use Batch generate if you only want to create statements without changing stages.",
      ].join("\n"),
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/fee-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch-reprice-by-current-fee-stage",
          registrationWindowId,
          displayCurrency,
        }),
      });
      const data = await readJsonResponse<{
        error?: string;
        results?: Array<{
          ok: boolean;
          error?: string;
          targetStageLabel?: string;
          changedCount?: number;
          skippedOverriddenCount?: number;
        }>;
      }>(response);
      if (!response.ok) throw new Error(data.error ?? "Batch reprice failed");
      const results = data.results ?? [];
      const okCount = results.filter((r) => r.ok).length;
      const failCount = results.filter((r) => !r.ok).length;
      const stageChanged = results
        .filter((r) => r.ok)
        .reduce((sum, r) => sum + (r.changedCount ?? 0), 0);
      const stageLabel =
        results.find((r) => r.ok && r.targetStageLabel)?.targetStageLabel ?? null;
      const failMessages = results
        .filter((r) => !r.ok)
        .map((r) => r.error)
        .filter(Boolean)
        .slice(0, 2);
      setMessage(
        `Batch reprice processed ${results.length} workspace(s): ${okCount} ok${
          stageLabel ? ` → ${stageLabel}` : ""
        }.${stageChanged ? ` ${stageChanged} exam stage update(s).` : ""}${
          failCount ? ` ${failCount} failed.` : ""
        }${failMessages.length ? ` ${failMessages.join("; ")}` : ""}`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch reprice failed");
    } finally {
      setLoading(false);
    }
  }

  const printable = statements.filter((s) => selectedIds.includes(s.id));
  const pageIds = useMemo(() => statements.map((statement) => statement.id), [statements]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const somePageSelected = pageIds.some((id) => selectedIds.includes(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  return (
    <>
      <Card className="space-y-4">
        <PageHeader
          title="Fee statement batch actions"
          description="Generate and print normal fee statements for internal student registrations only. Restricted and external registrations are excluded."
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
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as "all" | "unpaid" | "paid")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            aria-label="Filter by payment status"
          >
            <option value="all">All payment statuses</option>
            <option value="unpaid">Unpaid (Issued)</option>
            <option value="paid">Paid</option>
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
            disabled={loading || !registrationWindowId}
            onClick={() => void batchRepriceByCurrentFeeStage()}
            title="Re-evaluate Normal/Late/High Late from current fee-stage windows for all locked internal-normal registrations, then regenerate statements"
            className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
          >
            Batch reprice by current fee stage
          </button>
          <button
            type="button"
            disabled={printable.length === 0}
            onClick={() => setBatchPrintOpen(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            Batch print selected
          </button>
          <a href={feeRulesHref} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Fee rules
          </a>
        </div>
        {registrationWindowId ? (
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, Chinese name, or statement no…"
              className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
              aria-label="Search fee statements"
            />
            <p className="text-sm text-slate-500">
              {total} statement{total === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}
        {!registrationWindowId ? (
          <p className="text-sm text-slate-500">Select a registration window to view fee statements.</p>
        ) : listLoading && statements.length === 0 ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : statements.length === 0 ? (
          <p className="text-sm text-slate-500">
            {search
              ? "No fee statements match this search."
              : paymentFilter === "unpaid"
              ? "No unpaid (issued) fee statements for this window."
              : paymentFilter === "paid"
                ? "No paid fee statements for this window."
                : "No active fee statements for this window. If a previous statement was superseded after a registration change, use batch generate to create a new one."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-3 font-medium">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
                          }
                        }}
                        aria-label="Select all statements on this page"
                      />
                    </th>
                    <th className="py-2 pr-4 font-medium">Statement</th>
                    <th className="py-2 pr-4 font-medium">Candidate</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Payment</th>
                    <th className="py-2 pr-4 font-medium">Generated</th>
                    <th className="py-2 pr-4 font-medium">Online payment</th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {statements.map((statement) => (
                    <tr key={statement.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">
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
                      </td>
                      <td className="py-2 pr-4 font-medium text-slate-900">{statement.statementNo}</td>
                      <td className="py-2 pr-4">{statementCandidateLabel(statement)}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${feeStatementStatusClass(statement.status)}`}
                        >
                          {feeStatementStatusLabel(statement.status)}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${feePaymentPaidClass(
                            statement.status,
                            statement.paymentSettlement,
                          )}`}
                          title={
                            statement.paymentSettlement
                              ? `Settlement: ${statement.paymentSettlement}`
                              : undefined
                          }
                        >
                          {feePaymentPaidLabel(statement.status, statement.paymentSettlement)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-700">
                        {statement.generatedAt
                          ? new Date(statement.generatedAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-2 pr-4 align-top">
                        <StatementPaymentOrdersPanel
                          orders={statement.paymentOrders ?? []}
                          compact
                          onChanged={() => void load()}
                        />
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {statement.status === "DRAFT" ? (
                            <IconActionButton
                              label="Issue"
                              disabled={loading}
                              tone="primary"
                              onClick={() => void issueStatement(statement.id)}
                            >
                              <ActionIcon>
                                <path d="M22 2 11 13" />
                                <path d="M22 2 15 22 11 13 2 9z" />
                              </ActionIcon>
                            </IconActionButton>
                          ) : null}
                          <IconActionButton
                            label="Regenerate"
                            disabled={loading || !statement.registrationWorkspaceId}
                            tone={
                              statement.status === "NEEDS_REGENERATION" ? "warning" : "primary"
                            }
                            onClick={() => void regenerateStatement(statement)}
                          >
                            <ActionIcon>
                              <path d="M21 12a9 9 0 1 1-2.6-6.2" />
                              <path d="M21 3v6h-6" />
                            </ActionIcon>
                          </IconActionButton>
                          <IconActionButton
                            label="Reprice by current fee stage"
                            disabled={loading || !statement.registrationWorkspaceId}
                            tone="warning"
                            onClick={() => void repriceStatement(statement)}
                          >
                            <ActionIcon>
                              <path d="M12 2v20" />
                              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </ActionIcon>
                          </IconActionButton>
                          <IconActionButton
                            label="Mark as paid (offline)"
                            disabled={loading || statement.status !== "ISSUED"}
                            tone="success"
                            onClick={() => void markStatementPaidOffline(statement)}
                          >
                            <ActionIcon>
                              <path d="M20 6 9 17l-5-5" />
                            </ActionIcon>
                          </IconActionButton>
                          <IconActionButton
                            label="Preview"
                            onClick={() => setPreviewStatement({ statement, autoPrint: false })}
                          >
                            <ActionIcon>
                              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </ActionIcon>
                          </IconActionButton>
                          <IconActionButton
                            label="Print"
                            onClick={() => setPreviewStatement({ statement, autoPrint: true })}
                          >
                            <ActionIcon>
                              <path d="M6 9V2h12v7" />
                              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                              <path d="M6 14h12v8H6z" />
                            </ActionIcon>
                          </IconActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              loading={listLoading}
              itemLabel="statements"
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </Card>

      {batchPrintOpen && printable.length > 0 ? (
        <FeeStatementPrintModal
          statements={printable}
          displayCurrency={displayCurrency}
          onClose={() => setBatchPrintOpen(false)}
        />
      ) : null}

      {previewStatement ? (
        <FeeStatementPrintModal
          statements={[previewStatement.statement]}
          displayCurrency={previewStatement.statement.displayCurrency}
          autoPrint={previewStatement.autoPrint}
          onClose={() => setPreviewStatement(null)}
        />
      ) : null}

      {message || error ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div
            role="status"
            className={`pointer-events-auto max-w-xl rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ring-black/10 ${
              error ? "bg-red-700 text-white" : "bg-green-700 text-white"
            }`}
          >
            <div className="flex items-start gap-3">
              <p className="min-w-0 flex-1">{error ?? message}</p>
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setError(null);
                }}
                className="shrink-0 text-xs font-medium text-white/80 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
