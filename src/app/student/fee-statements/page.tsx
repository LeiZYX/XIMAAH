"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatMoney } from "@/lib/fees/money";

interface FeeStatementSummary {
  id: string;
  statementNo: string;
  status: string;
  totalGbpAmount: number | string;
  totalCnyAmount: number | string;
  issuedAt: string | null;
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

function FeeStatementCard({ statement }: { statement: FeeStatementSummary }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Statement</p>
          <p className="font-semibold text-slate-900">{statement.statementNo}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          {statement.status}
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-slate-500">Total GBP</dt>
            <dd className="font-medium text-slate-900">
              {formatMoney(Number(statement.totalGbpAmount), "GBP")}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Total CNY</dt>
            <dd className="font-medium text-slate-900">
              {formatMoney(Number(statement.totalCnyAmount), "CNY")}
            </dd>
          </div>
        </div>
        <div>
          <dt className="text-slate-500">Issued</dt>
          <dd className="font-medium text-slate-900">
            {statement.issuedAt ? new Date(statement.issuedAt).toLocaleDateString() : "—"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export default function StudentFeeStatementsPage() {
  const [statements, setStatements] = useState<FeeStatementSummary[]>([]);
  const [updating, setUpdating] = useState<UpdatingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    load();
  }, [load]);

  const hasContent = statements.length > 0 || updating.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My fee statements"
        description="View issued exam fee statements for your locked registrations."
      />

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
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {updating.map((entry, index) => (
              <UpdatingCard key={`updating-${index}`} entry={entry} />
            ))}
            {statements.map((statement) => (
              <FeeStatementCard key={statement.id} statement={statement} />
            ))}
          </div>
          <Card className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Statement</th>
                  <th className="py-2 pr-4">Window</th>
                  <th className="py-2 pr-4">Total GBP</th>
                  <th className="py-2 pr-4">Total CNY</th>
                  <th className="py-2 pr-4">Issued</th>
                </tr>
              </thead>
              <tbody>
                {updating.map((entry, index) => (
                  <tr key={`updating-${index}`} className="border-b border-amber-100 bg-amber-50/60">
                    <td className="py-2 pr-4 font-medium text-amber-950">Updating</td>
                    <td className="py-2 pr-4 text-amber-950">
                      {entry.registrationWindow.title}
                      <span className="block text-xs text-amber-800">{entry.message}</span>
                    </td>
                    <td className="py-2 pr-4">—</td>
                    <td className="py-2 pr-4">—</td>
                    <td className="py-2 pr-4">—</td>
                  </tr>
                ))}
                {statements.map((statement) => (
                  <tr key={statement.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{statement.statementNo}</td>
                    <td className="py-2 pr-4">
                      {statement.registrationWindow.title}
                      <span className="block text-xs text-slate-500">
                        {statement.registrationWindow.examBoard.code} ·{" "}
                        {statement.registrationWindow.examSeries.name} (
                        {statement.registrationWindow.examSeries.year})
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {formatMoney(Number(statement.totalGbpAmount), "GBP")}
                    </td>
                    <td className="py-2 pr-4">
                      {formatMoney(Number(statement.totalCnyAmount), "CNY")}
                    </td>
                    <td className="py-2 pr-4">
                      {statement.issuedAt
                        ? new Date(statement.issuedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
