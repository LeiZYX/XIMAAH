"use client";

import { useState } from "react";
import type { CandidateFeeDetailGroup } from "@/lib/fees/reporting";
import { formatMoney } from "@/lib/fees/money";

interface FeeDetailsCandidateGroupsProps {
  groups: CandidateFeeDetailGroup[];
  showCosts: boolean;
}

function CandidateGroupCard({
  group,
  showCosts,
  defaultExpanded,
}: {
  group: CandidateFeeDetailGroup;
  showCosts: boolean;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold text-slate-900">{group.candidateName}</p>
          <p className="text-sm text-slate-600">
            {group.assessmentHubCandidateNumber
              ? `AH ${group.assessmentHubCandidateNumber}`
              : group.studentNumber
                ? `Student ${group.studentNumber}`
                : "—"}
            {group.candidateType ? ` · ${group.candidateType}` : ""}
            {group.grade || group.className
              ? ` · ${[group.grade, group.className].filter(Boolean).join(" ")}`
              : ""}
          </p>
          <p className="text-xs text-slate-500">
            {group.lineCount} exam {group.lineCount === 1 ? "entry" : "entries"}
            {group.statementNo ? ` · Statement ${group.statementNo}` : ""}
            {group.statementStatus ? ` · ${group.statementStatus.replace(/_/g, " ")}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-sm">
          <div className="text-right">
            <p className="font-medium text-slate-900">{formatMoney(group.totalSalesGbp, "GBP")}</p>
            <p className="text-slate-600">{formatMoney(group.totalSalesCny, "CNY")}</p>
          </div>
          <span className="text-slate-400">{expanded ? "▾" : "▸"}</span>
        </div>
      </button>

      {expanded ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-white text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Paper</th>
                <th className="px-3 py-2">Entry</th>
                <th className="px-3 py-2">Exam date</th>
                {showCosts ? (
                  <>
                    <th className="px-3 py-2">Cost</th>
                    <th className="px-3 py-2">Markup</th>
                  </>
                ) : null}
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Sales GBP</th>
                <th className="px-3 py-2">Sales CNY</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {group.lines.map((row, index) => (
                <tr key={`${row.paperCode}-${index}`}>
                  <td className="px-3 py-2">{row.subjectName}</td>
                  <td className="px-3 py-2">
                    {row.paperCode}
                    {row.paperTitle ? ` · ${row.paperTitle}` : ""}
                  </td>
                  <td className="px-3 py-2">{row.entryType}</td>
                  <td className="px-3 py-2">{row.examDate?.slice(0, 10) ?? "—"}</td>
                  {showCosts ? (
                    <>
                      <td className="px-3 py-2">
                        {row.costAmount != null ? `${row.costCurrency} ${row.costAmount}` : "—"}
                      </td>
                      <td className="px-3 py-2">{row.markupType ?? "—"}</td>
                    </>
                  ) : null}
                  <td className="px-3 py-2">{row.exchangeRate ?? "—"}</td>
                  <td className="px-3 py-2">{formatMoney(row.salesGbp, "GBP")}</td>
                  <td className="px-3 py-2">{formatMoney(row.salesCny, "CNY")}</td>
                  <td className="px-3 py-2">{row.statementStatus.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function FeeDetailsCandidateGroups({ groups, showCosts }: FeeDetailsCandidateGroupsProps) {
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        No fee details for current filters.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <CandidateGroupCard
          key={group.candidateKey}
          group={group}
          showCosts={showCosts}
          defaultExpanded={groups.length <= 5}
        />
      ))}
    </div>
  );
}
