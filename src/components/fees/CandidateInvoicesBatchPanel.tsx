"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  FeeStatementPrintModal,
  type FeeStatementPrintData,
} from "@/components/fees/FeeStatementPrintModal";
import { StatementPaymentOrdersPanel } from "@/components/fees/StatementPaymentOrdersPanel";
import { StudentFeePaymentPanel } from "@/components/fees/StudentFeePaymentPanel";
import { readJsonResponse } from "@/lib/client/fetch-json";
import {
  DEFAULT_FEE_STATEMENT_DISPLAY_CURRENCY,
  type FeeStatementDisplayCurrencyOption,
} from "@/lib/fees/display-currency";
import { LIST_PAGE_SIZES } from "@/lib/pagination";
import {
  feeStatementStatusClass,
  feeStatementStatusLabel,
} from "@/lib/fees/workspace-status";

interface CandidateInvoicesBatchPanelProps {
  registrationWindowId: string;
  feeRulesHref: string;
  statementKind: "RESTRICTED" | "EXTERNAL";
  batchAction: "batch-restricted" | "batch-external";
  title: string;
  description: string;
  candidateColumnLabel?: string;
  itemLabel?: string;
}

interface PaginatedStatements {
  statements: FeeStatementPrintData[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

export function CandidateInvoicesBatchPanel({
  registrationWindowId,
  feeRulesHref,
  statementKind,
  batchAction,
  title,
  description,
  candidateColumnLabel = "Candidate",
  itemLabel = "fee statements",
}: CandidateInvoicesBatchPanelProps) {
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
  const [paymentFilter, setPaymentFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [previewStatement, setPreviewStatement] = useState<{
    statement: FeeStatementPrintData;
    autoPrint: boolean;
  } | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setPage(1), 0);
    return () => window.clearTimeout(timeoutId);
  }, [registrationWindowId, statementKind]);

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
        statementKind,
      });
      if (paymentFilter !== "all") {
        params.set("paymentStatus", paymentFilter);
      }
      const response = await fetch(`/api/fee-statements?${params.toString()}`);
      const data = await readJsonResponse<PaginatedStatements>(response);
      if (response.ok && data.statements) {
        setStatements(data.statements);
        setTotal(data.total);
        setTotalPages(data.totalPages);
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
  }, [registrationWindowId, page, pageSize, statementKind, paymentFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
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
          action: batchAction,
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
      setMessage(`${data.statementNo ?? "Fee statement"} issued.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Issue failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card className="space-y-4">
        <PageHeader title={title} description={description} />
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
            onChange={(e) => {
              setPaymentFilter(e.target.value as "all" | "unpaid" | "paid");
              setPage(1);
            }}
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
          <a
            href={feeRulesHref}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Fee rules
          </a>
        </div>
        {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p> : null}
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

        {!registrationWindowId ? (
          <p className="text-sm text-slate-500">Select a registration window to view invoices.</p>
        ) : listLoading && statements.length === 0 ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : statements.length === 0 ? (
            <p className="text-sm text-slate-500">
              {paymentFilter === "unpaid"
                ? "No unpaid (issued) fee statements for this window."
                : paymentFilter === "paid"
                  ? "No paid fee statements for this window."
                  : "No fee statements for this window yet."}
            </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-4 font-medium">Statement</th>
                    <th className="py-2 pr-4 font-medium">{candidateColumnLabel}</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Online payment</th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {statements.map((statement) => (
                    <Fragment key={statement.id}>
                      <tr key={statement.id} className="border-b border-slate-100">
                        <td className="py-2 pr-4 font-medium text-slate-900">{statement.statementNo}</td>
                        <td className="py-2 pr-4">{statement.studentNameSnapshot}</td>
                        <td className="py-2 pr-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${feeStatementStatusClass(statement.status)}`}
                          >
                            {feeStatementStatusLabel(statement.status)}
                          </span>
                        </td>
                        <td className="py-2 pr-4 align-top">
                          <StatementPaymentOrdersPanel
                            orders={statement.paymentOrders ?? []}
                            compact
                            onChanged={() => void load()}
                          />
                        </td>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-2">
                            {statement.status === "DRAFT" ? (
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => void issueStatement(statement.id)}
                                className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                Issue
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setPreviewStatement({ statement, autoPrint: false })}
                              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewStatement({ statement, autoPrint: true })}
                              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Print
                            </button>
                          </div>
                        </td>
                      </tr>
                      {statement.status === "ISSUED" ||
                      statement.status === "PAID" ||
                      (statement.paymentOrders?.length ?? 0) > 0 ? (
                        <tr key={`${statement.id}-payment`} className="border-b border-slate-200 bg-slate-50/50">
                          <td colSpan={5} className="px-4 py-3">
                            {statement.status === "ISSUED" ? (
                              <StudentFeePaymentPanel
                                feeStatementId={statement.id}
                                statementStatus={statement.status}
                                totalGbpAmount={statement.totalGbpAmount}
                                amountDueGbpAmount={statement.amountDueGbpAmount}
                                previouslyPaidGbpAmount={statement.previouslyPaidGbpAmount}
                                existingOrders={statement.paymentOrders ?? []}
                                onPaid={() => void load()}
                              />
                            ) : null}
                            {statement.status === "PAID" ? (
                              <p className="text-sm font-medium text-emerald-800">Payment complete.</p>
                            ) : null}
                            <div className="mt-2">
                              <StatementPaymentOrdersPanel
                                orders={statement.paymentOrders ?? []}
                                onChanged={() => void load()}
                              />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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
              itemLabel={itemLabel}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </Card>

      {previewStatement ? (
        <FeeStatementPrintModal
          statements={[previewStatement.statement]}
          displayCurrency={previewStatement.statement.displayCurrency}
          autoPrint={previewStatement.autoPrint}
          onClose={() => setPreviewStatement(null)}
        />
      ) : null}
    </>
  );
}
