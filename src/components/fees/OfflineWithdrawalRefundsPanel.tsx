"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { FeeManagementNav } from "@/components/fees/FeeManagementNav";
import {
  RegistrationWindowSelectorFields,
  useRegistrationWindowSelector,
} from "@/components/registrations/RegistrationWindowSelector";
import { formatMoney } from "@/lib/fees/money";
import { FeeRefundModal } from "@/components/fees/FeeRefundModal";
import { useStaffFeeCaps } from "@/components/fees/useStaffFeeCaps";

type RefundLine = {
  id: string;
  status: "PENDING_OFFLINE" | "COMPLETED" | "ZERO_NO_REFUND" | "NO_CASH_UNCOLLECTED";
  paperCodeSnapshot: string;
  subjectSnapshot: string;
  feeStageCode: string;
  salesAmountGbp: number;
  effectiveRefundPercent: number;
  creditGbp: number;
  remainingGbp?: number;
  calculationNotes: string | null;
  offlineReference: string | null;
  offlineNote: string | null;
  createdAt: string;
  completedAt: string | null;
  completedByUser: { name: string } | null;
};

type RefundGroup = {
  workspaceId: string;
  registrationNumber: string | null;
  candidate: {
    id: string;
    englishName: string;
    chineseName: string | null;
    studentNumber: string | null;
    assessmentHubCandidateNumber: string;
  } | null;
  registrationWindow: { id: string; title: string; academicYear: string };
  rollupStatus: "PENDING_OFFLINE" | "COMPLETED" | "MIXED" | "ZERO_NO_REFUND" | "NO_CASH_UNCOLLECTED";
  pendingCount: number;
  completedCount: number;
  pendingCreditGbp: number;
  completedCreditGbp: number;
  onlinePaidGbp: number;
  alreadyPaidGbp: number;
  priorBilledGbp: number | null;
  paymentSource: "ONLINE" | "STATEMENT_SNAPSHOT" | "NO_ONLINE_PAYMENT_RECORDED" | "NONE";
  statement: {
    id: string;
    statementNo: string;
    status: string;
    totalGbp: number;
    previouslyPaidGbp: number;
    amountDueGbp: number;
    paymentNotes: string | null;
  } | null;
  lines: RefundLine[];
};

function statusLabel(status: RefundGroup["rollupStatus"] | RefundLine["status"]) {
  switch (status) {
    case "PENDING_OFFLINE":
      return "Pending offline";
    case "COMPLETED":
      return "Completed";
    case "MIXED":
      return "Partially completed";
    case "ZERO_NO_REFUND":
      return "No refund due";
    case "NO_CASH_UNCOLLECTED":
      return "Not charged — nothing collected";
    default:
      return status;
  }
}

function candidateLabel(group: RefundGroup) {
  const name = group.candidate?.englishName ?? "—";
  const chinese = group.candidate?.chineseName?.trim();
  return chinese ? `${name} (${chinese})` : name;
}

export function OfflineWithdrawalRefundsPanel({
  basePath,
}: {
  basePath: "/admin" | "/exam-office" | "/finance";
}) {
  const windowSelector = useRegistrationWindowSelector({
    scope: "staff",
    allowEmpty: true,
  });
  const [status, setStatus] = useState<
    "PENDING_OFFLINE" | "COMPLETED" | "ZERO_NO_REFUND" | "NO_CASH_UNCOLLECTED" | "ALL"
  >("PENDING_OFFLINE");
  const [groups, setGroups] = useState<RefundGroup[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<{
    statementId: string;
    statementNo: string;
    lineIds: string[];
  } | null>(null);
  const feeCaps = useStaffFeeCaps();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ status });
    if (windowSelector.registrationWindowId) {
      params.set("registrationWindowId", windowSelector.registrationWindowId);
    }
    const response = await fetch(`/api/offline-withdrawal-refunds?${params.toString()}`);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Failed to load offline refunds");
      setGroups([]);
      setLoading(false);
      return;
    }
    const data = (await response.json()) as { groups?: RefundGroup[] };
    setGroups(Array.isArray(data.groups) ? data.groups : []);
    setLoading(false);
  }, [status, windowSelector.registrationWindowId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  function toggleExpanded(workspaceId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(workspaceId)) next.delete(workspaceId);
      else next.add(workspaceId);
      return next;
    });
  }

  const pendingStudentCount = groups.filter((group) => group.pendingCount > 0).length;
  const pendingCreditTotal = groups.reduce((sum, group) => sum + group.pendingCreditGbp, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Offline withdrawal refunds"
        description="Student-level queue for finance: prior billed vs revised total, online paid, amount due, and withdrawal credit. Record the actual refund (original channel or offline) from Record refund. This system does not send the money."
      />
      <FeeManagementNav basePath={basePath} />

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <RegistrationWindowSelectorFields
            state={windowSelector}
            layout="inline"
            allowEmpty
            emptyOptionLabel="All windows"
          />
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="PENDING_OFFLINE">Pending offline</option>
              <option value="NO_CASH_UNCOLLECTED">Not charged — nothing collected</option>
              <option value="COMPLETED">Completed</option>
              <option value="ZERO_NO_REFUND">No refund due</option>
              <option value="ALL">All</option>
            </select>
          </label>
        </div>

        {!loading && groups.length > 0 ? (
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-slate-500">Students in list</p>
              <p className="text-lg font-semibold text-slate-900">{groups.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-slate-500">With pending refund</p>
              <p className="text-lg font-semibold text-slate-900">{pendingStudentCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-slate-500">Pending credit total</p>
              <p className="text-lg font-semibold text-slate-900">
                {formatMoney(pendingCreditTotal, "GBP")}
              </p>
            </div>
          </div>
        ) : null}

        {message ? (
          <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
        ) : null}
        {error ? (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-slate-600">No records for this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Student</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Window</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Prior billed</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Revised total</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Online paid</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Amount due</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Pending refund</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {groups.map((group) => {
                  const expanded = expandedIds.has(group.workspaceId);
                  const pendingIds = group.lines
                    .filter((line) => line.status === "PENDING_OFFLINE")
                    .map((line) => line.id);
                  const detailHref =
                    basePath === "/finance"
                      ? `/finance/fee-statements?registrationWindowId=${group.registrationWindow.id}`
                      : `${basePath}/registrations/${group.workspaceId}#fee-statement`;
                  return (
                    <Fragment key={group.workspaceId}>
                      <tr className="align-top">
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(group.workspaceId)}
                            className="text-left"
                          >
                            <div className="font-medium text-slate-900">{candidateLabel(group)}</div>
                            <div className="text-xs text-slate-500">
                              {group.registrationNumber ?? "—"}
                              {" · "}
                              {group.candidate?.studentNumber ??
                                group.candidate?.assessmentHubCandidateNumber ??
                                "—"}
                              {" · "}
                              {expanded ? "Hide lines" : `${group.lines.length} line(s)`}
                            </div>
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <div>{group.registrationWindow.title}</div>
                          <div className="text-xs text-slate-500">
                            {group.registrationWindow.academicYear}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {group.priorBilledGbp != null
                            ? formatMoney(group.priorBilledGbp, "GBP")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {group.statement
                            ? formatMoney(group.statement.totalGbp, "GBP")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div>{formatMoney(group.onlinePaidGbp ?? group.alreadyPaidGbp ?? 0, "GBP")}</div>
                          {group.paymentSource === "NO_ONLINE_PAYMENT_RECORDED" ? (
                            <div className="text-xs text-amber-700">No online payment recorded</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {group.statement
                            ? formatMoney(group.statement.amountDueGbp, "GBP")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatMoney(group.pendingCreditGbp, "GBP")}
                          {group.completedCreditGbp > 0 ? (
                            <div className="text-xs font-normal text-slate-500">
                              Done {formatMoney(group.completedCreditGbp, "GBP")}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <div>{statusLabel(group.rollupStatus)}</div>
                          {group.statement?.statementNo ? (
                            <div className="text-xs text-slate-500">{group.statement.statementNo}</div>
                          ) : (
                            <div className="text-xs text-amber-700">No active statement</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <Link
                              href={detailHref}
                              className="text-xs font-medium text-indigo-700 hover:underline"
                            >
                              Open fee statement
                            </Link>
                            {feeCaps.canRecordRefund && pendingIds.length > 0 ? (
                              <button
                                type="button"
                                disabled={!group.statement}
                                title={
                                  group.statement
                                    ? "Record refund"
                                    : "Generate a fee statement first"
                                }
                                onClick={() => {
                                  if (!group.statement) return;
                                  setRefundTarget({
                                    statementId: group.statement.id,
                                    statementNo: group.statement.statementNo,
                                    lineIds: pendingIds,
                                  });
                                }}
                                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                Record refund
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {expanded
                        ? group.lines.map((line) => (
                            <tr key={line.id} className="bg-slate-50/80">
                              <td className="px-3 py-2 pl-8" colSpan={2}>
                                <div className="font-mono text-xs">{line.paperCodeSnapshot}</div>
                                <div className="text-xs text-slate-500">{line.subjectSnapshot}</div>
                                {line.calculationNotes ? (
                                  <div className="mt-1 text-xs text-slate-500">
                                    {line.calculationNotes}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 text-right text-xs text-slate-600" colSpan={4}>
                                Sales {formatMoney(line.salesAmountGbp, "GBP")} ·{" "}
                                {line.effectiveRefundPercent}%
                              </td>
                              <td className="px-3 py-2 text-right font-medium">
                                {formatMoney(line.remainingGbp ?? line.creditGbp, "GBP")}
                                {line.remainingGbp != null && line.remainingGbp < line.creditGbp ? (
                                  <div className="text-xs font-normal text-slate-500">
                                    of {formatMoney(line.creditGbp, "GBP")}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2">
                                <div>{statusLabel(line.status)}</div>
                                {line.offlineReference ? (
                                  <div className="text-xs text-slate-500">
                                    Ref: {line.offlineReference}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {line.status === "PENDING_OFFLINE" ? (
                                  <button
                                    type="button"
                                    disabled={!group.statement}
                                    title={
                                      group.statement
                                        ? "Record refund"
                                        : "Generate a fee statement first"
                                    }
                                    onClick={() => {
                                      if (!group.statement) return;
                                      setRefundTarget({
                                        statementId: group.statement.id,
                                        statementNo: group.statement.statementNo,
                                        lineIds: [line.id],
                                      });
                                    }}
                                    className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                                  >
                                    Record refund
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400">
                                    {line.completedByUser?.name
                                      ? `By ${line.completedByUser.name}`
                                      : "—"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {refundTarget ? (
        <FeeRefundModal
          statementId={refundTarget.statementId}
          statementNo={refundTarget.statementNo}
          initialLineIds={refundTarget.lineIds}
          onClose={() => setRefundTarget(null)}
          onSaved={(text) => {
            setError(null);
            setMessage(text);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

