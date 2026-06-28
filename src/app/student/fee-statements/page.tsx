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

export default function StudentFeeStatementsPage() {
  const [statements, setStatements] = useState<FeeStatementSummary[]>([]);
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
      setStatements(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load fee statements");
      setStatements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      ) : statements.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">No issued fee statements yet.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
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
              {statements.map((statement) => (
                <tr key={statement.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{statement.statementNo}</td>
                  <td className="py-2 pr-4">
                    {statement.registrationWindow.title}
                    <span className="block text-xs text-slate-500">
                      {statement.registrationWindow.examBoard.code} ·{" "}
                      {statement.registrationWindow.examSeries.name} ({statement.registrationWindow.examSeries.year})
                    </span>
                  </td>
                  <td className="py-2 pr-4">{formatMoney(Number(statement.totalGbpAmount), "GBP")}</td>
                  <td className="py-2 pr-4">{formatMoney(Number(statement.totalCnyAmount), "CNY")}</td>
                  <td className="py-2 pr-4">
                    {statement.issuedAt ? new Date(statement.issuedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
