"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  StudentFeePaymentPanel,
  type StudentPaymentOrder,
} from "@/components/fees/StudentFeePaymentPanel";
import { feeStatementStatusClass, feeStatementStatusLabel } from "@/lib/fees/workspace-status";
import { formatMoney } from "@/lib/fees/money";

interface FeeStatementSummary {
  id: string;
  statementNo: string;
  status: string;
  totalGbpAmount: number | string;
  totalCnyAmount: number | string;
  previouslyPaidGbpAmount?: number | string | null;
  amountDueGbpAmount?: number | string | null;
  paymentNotes?: string | null;
  issuedAt: string | null;
  paymentOrders?: StudentPaymentOrder[];
  registrationWindow: {
    title: string;
    examBoard: { code: string };
    examSeries: { name: string; year: number };
  };
}

interface UpdatingEntry {
  status: "UPDATING";
  message: string;
  registrationWindow: FeeStatementSummary["registrationWindow"] & { id?: string };
}

function UpdatingCard({ entry }: { entry: UpdatingEntry }) {
  return (
    <article className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Fee statement</p>
          <p className="font-semibold text-amber-950">Updating</p>
        </div>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
          Updating
        </span>
      </div>
      <p className="mt-3 text-sm text-amber-950">{entry.message}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-amber-800">Registration window</dt>
          <dd className="font-medium text-amber-950">{entry.registrationWindow.title}</dd>
          <dd className="text-xs text-amber-800">
            {entry.registrationWindow.examBoard.code} · {entry.registrationWindow.examSeries.name} (
            {entry.registrationWindow.examSeries.year})
          </dd>
        </div>
      </dl>
    </article>
  );
}

function FeeStatementCard({
  statement,
  onPaid,
}: {
  statement: FeeStatementSummary;
  onPaid: () => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Statement</p>
          <p className="font-semibold text-slate-900">{statement.statementNo}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${feeStatementStatusClass(statement.status)}`}
        >
          {feeStatementStatusLabel(statement.status)}
        </span>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-slate-500">Registration window</dt>
          <dd className="font-medium text-slate-900">{statement.registrationWindow.title}</dd>
          <dd className="text-xs text-slate-500">
            {statement.registrationWindow.examBoard.code} ·{" "}
            {statement.registrationWindow.examSeries.name} (
            {statement.registrationWindow.examSeries.year})
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Fee total (GBP)</dt>
          <dd className="font-medium text-slate-900">
            {formatMoney(Number(statement.totalGbpAmount), "GBP")}
          </dd>
        </div>
        {Number(statement.previouslyPaidGbpAmount ?? 0) > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-slate-500">Already paid</dt>
              <dd className="font-medium text-slate-900">
                {formatMoney(Number(statement.previouslyPaidGbpAmount), "GBP")}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Amount due</dt>
              <dd className="font-medium text-slate-900">
                {formatMoney(
                  Number(
                    statement.amountDueGbpAmount ?? statement.totalGbpAmount,
                  ),
                  "GBP",
                )}
              </dd>
            </div>
          </div>
        ) : null}
        {statement.paymentNotes ? (
          <p className="text-xs text-slate-600">{statement.paymentNotes}</p>
        ) : null}
        <div>
          <dt className="text-slate-500">Issued</dt>
          <dd className="font-medium text-slate-900">
            {statement.issuedAt ? new Date(statement.issuedAt).toLocaleDateString() : "—"}
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <StudentFeePaymentPanel
          feeStatementId={statement.id}
          statementStatus={statement.status}
          totalGbpAmount={statement.totalGbpAmount}
          amountDueGbpAmount={statement.amountDueGbpAmount}
          previouslyPaidGbpAmount={statement.previouslyPaidGbpAmount}
          existingOrders={statement.paymentOrders ?? []}
          onPaid={onPaid}
        />
      </div>
    </article>
  );
}

export default function StudentFeeStatementsPage() {
  const [statements, setStatements] = useState<FeeStatementSummary[]>([]);
  const [updating, setUpdating] = useState<UpdatingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/student/fee-statements");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not load fee statements");
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setStatements(data);
        setUpdating([]);
      } else {
        setStatements(Array.isArray(data.statements) ? data.statements : []);
        setUpdating(Array.isArray(data.updating) ? data.updating : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load fee statements");
      setStatements([]);
      setUpdating([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredStatements = statements.filter((statement) => {
    if (statusFilter === "PAID") return statement.status === "PAID";
    if (statusFilter === "UNPAID") return statement.status === "ISSUED";
    return true;
  });

  const hasContent = filteredStatements.length > 0 || updating.length > 0 || statements.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My fee statements"
        description="View issued exam fee statements and pay online in GBP via WeChat or Alipay."
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-600" htmlFor="student-fee-status-filter">
          Filter
        </label>
        <select
          id="student-fee-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | "UNPAID" | "PAID")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800"
        >
          <option value="ALL">All</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : !hasContent ? (
        <Card>
          <p className="text-sm text-slate-600">No issued fee statements yet.</p>
        </Card>
      ) : filteredStatements.length === 0 && updating.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">No statements match this filter.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {updating.map((entry, index) => (
            <UpdatingCard key={`updating-${index}`} entry={entry} />
          ))}
          {filteredStatements.map((statement) => (
            <FeeStatementCard key={statement.id} statement={statement} onPaid={() => void load()} />
          ))}
        </div>
      )}
    </div>
  );
}
