"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  CASH_IN_REQUEST_STATUSES,
  canCancelCashInRequest,
  cashInRequestStatusLabel,
} from "@/lib/cash-in-requests/status";
import { isCashInFeeStatementPayable } from "@/lib/cash-in-requests/billing-utils";
import { formatMoney } from "@/lib/fees/money";

interface ExamBoardOption {
  id: string;
  name: string;
  code: string;
}

interface CandidateOption {
  id: string;
  englishName: string;
  assessmentHubCandidateNumber: string;
}

interface SeriesOption {
  id: string;
  name: string;
  year: number;
}

interface SubjectOption {
  id: string;
  name: string;
  code: string;
  cashInCode: string;
}

interface QualificationOption {
  id: string;
  name: string;
  level: string;
  code: string | null;
  subjects: SubjectOption[];
}

interface CashInRequestRow {
  id: string;
  status: string;
  cashInCode: string;
  quoteMatchLevel: string | null;
  quotedSalesAmount: string | number | null;
  quotedSalesCurrency: string | null;
  createdAt: string;
  candidate?: {
    englishName: string | null;
    preferredEnglishName: string | null;
    assessmentHubCandidateNumber: string | null;
  };
  examBoard?: { name: string; code: string };
  examSeries?: { name: string; year: number };
  qualification?: { level: string; code: string | null };
  subject?: { name: string; code: string };
  requestedBy?: { name: string | null };
  feeStatement?: {
    id: string;
    statementNo: string;
    status: string;
    totalGbpAmount: string | number;
    amountDueGbpAmount: string | number | null;
  } | null;
}

export function CashInRequestsManager({
  basePath,
}: {
  basePath: "/admin" | "/exam-office";
}) {
  const [boards, setBoards] = useState<ExamBoardOption[]>([]);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [rows, setRows] = useState<CashInRequestRow[]>([]);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [qualifications, setQualifications] = useState<QualificationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [filterBoardId, setFilterBoardId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterQ, setFilterQ] = useState("");

  const [examBoardId, setExamBoardId] = useState("");
  const [examSeriesId, setExamSeriesId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [qualificationId, setQualificationId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [quotePreview, setQuotePreview] = useState<{
    found: boolean;
    matchLevel: string | null;
    salesAmount?: number;
    salesCurrency?: string;
  } | null>(null);

  const selectedQualification = useMemo(
    () => qualifications.find((item) => item.id === qualificationId) ?? null,
    [qualifications, qualificationId],
  );
  const selectedSubject = useMemo(
    () => selectedQualification?.subjects.find((item) => item.id === subjectId) ?? null,
    [selectedQualification, subjectId],
  );

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterBoardId) params.set("examBoardId", filterBoardId);
      if (filterStatus) params.set("status", filterStatus);
      if (filterQ.trim()) params.set("q", filterQ.trim());
      const response = await fetch(`/api/cash-in-requests?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load requests");
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [filterBoardId, filterStatus, filterQ]);

  useEffect(() => {
    void fetch("/api/exam-boards")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ExamBoardOption[]) => {
        setBoards(data);
        if (data[0]?.id) {
          setFilterBoardId((current) => current || data[0]!.id);
          setExamBoardId((current) => current || data[0]!.id);
        }
      });
    void fetch("/api/candidates/search")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCandidates(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    setExamSeriesId("");
    setQualificationId("");
    setSubjectId("");
    setSeries([]);
    setQualifications([]);
    setQuotePreview(null);
    if (!examBoardId) return;
    void fetch(`/api/cash-in-requests/options?examBoardId=${encodeURIComponent(examBoardId)}`)
      .then((r) => (r.ok ? r.json() : { series: [], qualifications: [] }))
      .then((data: { series: SeriesOption[]; qualifications: QualificationOption[] }) => {
        setSeries(data.series ?? []);
        setQualifications(data.qualifications ?? []);
      });
  }, [examBoardId]);

  useEffect(() => {
    setQuotePreview(null);
    if (!examBoardId || !examSeriesId || !subjectId) return;
    const params = new URLSearchParams({
      examBoardId,
      examSeriesId,
      subjectId,
    });
    if (qualificationId) params.set("qualificationId", qualificationId);
    void fetch(`/api/fees/cash-in-quote?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setQuotePreview({
          found: Boolean(data.found),
          matchLevel: data.matchLevel ?? null,
          salesAmount: data.schedule?.salesAmount,
          salesCurrency: data.schedule?.salesCurrency,
        });
      });
  }, [examBoardId, examSeriesId, qualificationId, subjectId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/cash-in-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
          examBoardId,
          examSeriesId,
          qualificationId,
          subjectId,
          notes: notes || null,
          status: "DRAFT",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to create");
      setMessage(`Created cash-in request ${data.cashInCode}.`);
      setNotes("");
      setSubjectId("");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function changeStatus(row: CashInRequestRow, status: string) {
    if (status === "CANCELLED") {
      const confirmed = window.confirm(
        "Cancel this cash-in request?\n\nAllowed only before it is sent to the exam board. Refund handling comes in a later billing phase if already paid.",
      );
      if (!confirmed) return;
    }
    if (status === "SENT_TO_BOARD") {
      const confirmed = window.confirm(
        "Mark as sent to the exam board?\n\nRequires the fee statement to be paid. After this, cancellation is blocked.",
      );
      if (!confirmed) return;
    }

    setError(null);
    setMessage(null);
    const response = await fetch(`/api/cash-in-requests/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to update status");
      return;
    }
    setMessage(`Updated to ${cashInRequestStatusLabel(status)}.`);
    await loadRows();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash-in Requests"
        description="Create and track cash-in requests. Submitting issues a student fee statement; payment is required before sending to the board."
      />

      <Card className="space-y-2 text-sm text-slate-700">
        <p>
          Setup:{" "}
          <Link href={`${basePath}/cash-in-codes`} className="text-indigo-700 hover:underline">
            Cash-in Codes
          </Link>
          {" · "}
          <Link href={`${basePath}/fee-schedules`} className="text-indigo-700 hover:underline">
            Fee Schedule (CASH_IN)
          </Link>
        </p>
        <p>
          Flow: Draft → Submit (issues fee statement) → student pays → Sent to board → Complete.
          Cancel is allowed only while Draft or Submitted (before Sent to board).
        </p>
      </Card>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">New cash-in request</h2>
        <form onSubmit={(event) => void handleCreate(event)} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Candidate</span>
            <select
              required
              value={candidateId}
              onChange={(event) => setCandidateId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Select candidate</option>
              {candidates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.englishName} ({item.assessmentHubCandidateNumber})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Exam board</span>
            <select
              required
              value={examBoardId}
              onChange={(event) => setExamBoardId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Select board</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name} ({board.code})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Exam series</span>
            <select
              required
              value={examSeriesId}
              onChange={(event) => setExamSeriesId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              disabled={!examBoardId}
            >
              <option value="">Select series</option>
              {series.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} {item.year}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Qualification</span>
            <select
              required
              value={qualificationId}
              onChange={(event) => {
                setQualificationId(event.target.value);
                setSubjectId("");
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              disabled={!examBoardId}
            >
              <option value="">Select qualification with cash-in codes</option>
              {qualifications.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.level}
                  {item.code ? ` · ${item.code}` : ""} — {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Subject</span>
            <select
              required
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              disabled={!selectedQualification}
            >
              <option value="">Select subject</option>
              {(selectedQualification?.subjects ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {item.name} ({item.cashInCode})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Notes</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p>
              Cash-in code:{" "}
              <span className="font-medium text-slate-900">
                {selectedSubject?.cashInCode ?? "—"}
              </span>
            </p>
            <p className="mt-1">
              Quoted sales:{" "}
              <span className="font-medium text-slate-900">
                {quotePreview?.found
                  ? `${quotePreview.salesCurrency} ${quotePreview.salesAmount} (${quotePreview.matchLevel})`
                  : "No matching fee schedule yet (Draft still allowed)"}
              </span>
            </p>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create draft request"}
            </button>
          </div>
        </form>
      </Card>

      <Card className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Filter board</span>
            <select
              value={filterBoardId}
              onChange={(event) => {
                setFilterBoardId(event.target.value);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">All boards</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Filter status</span>
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">All statuses</option>
              {CASH_IN_REQUEST_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {cashInRequestStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Search</span>
            <input
              value={filterQ}
              onChange={(event) => setFilterQ(event.target.value)}
              placeholder="Candidate, subject, cash-in code"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        {loading ? <p className="text-sm text-slate-600">Loading…</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="text-sm text-slate-600">No cash-in requests yet.</p>
        ) : null}

        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Candidate</th>
                  <th className="px-3 py-2 text-left">Series</th>
                  <th className="px-3 py-2 text-left">Subject</th>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Quote</th>
                  <th className="px-3 py-2 text-left">Bill</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      {row.candidate?.preferredEnglishName ||
                        row.candidate?.englishName ||
                        "—"}
                      <div className="text-xs text-slate-500">
                        {row.candidate?.assessmentHubCandidateNumber ?? ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {row.examSeries
                        ? `${row.examSeries.name} ${row.examSeries.year}`
                        : "—"}
                      <div className="text-xs text-slate-500">{row.examBoard?.code}</div>
                    </td>
                    <td className="px-3 py-2">
                      {row.subject ? `${row.subject.code} · ${row.subject.name}` : "—"}
                      <div className="text-xs text-slate-500">
                        {row.qualification?.level ?? ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-medium">{row.cashInCode}</td>
                    <td className="px-3 py-2">
                      {row.quotedSalesAmount != null
                        ? `${row.quotedSalesCurrency} ${row.quotedSalesAmount}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.feeStatement ? (
                        <>
                          <div className="font-medium">{row.feeStatement.statementNo}</div>
                          <div className="text-xs text-slate-500">
                            {row.feeStatement.status}
                            {row.feeStatement.status === "ISSUED"
                              ? ` · due ${formatMoney(
                                  Number(
                                    row.feeStatement.amountDueGbpAmount ??
                                      row.feeStatement.totalGbpAmount,
                                  ),
                                  "GBP",
                                )}`
                              : ""}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{cashInRequestStatusLabel(row.status)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {row.status === "DRAFT" ? (
                          <button
                            type="button"
                            className="text-indigo-700 hover:underline"
                            onClick={() => void changeStatus(row, "SUBMITTED")}
                          >
                            Submit
                          </button>
                        ) : null}
                        {row.status === "SUBMITTED" ? (
                          <button
                            type="button"
                            className="text-indigo-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                            disabled={
                              !row.feeStatement || !isCashInFeeStatementPayable(row.feeStatement)
                            }
                            title={
                              row.feeStatement && isCashInFeeStatementPayable(row.feeStatement)
                                ? "Mark as sent to the exam board"
                                : "Student payment required first"
                            }
                            onClick={() => void changeStatus(row, "SENT_TO_BOARD")}
                          >
                            Sent to board
                          </button>
                        ) : null}
                        {row.status === "SENT_TO_BOARD" ? (
                          <button
                            type="button"
                            className="text-indigo-700 hover:underline"
                            onClick={() => void changeStatus(row, "COMPLETED")}
                          >
                            Complete
                          </button>
                        ) : null}
                        {canCancelCashInRequest(row.status) ? (
                          <button
                            type="button"
                            className="text-red-700 hover:underline"
                            onClick={() => void changeStatus(row, "CANCELLED")}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
