"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExamDocumentCentreHeader } from "@/components/exam-documents/ExamDocumentCentreHeader";
import { PageHeader } from "@/components/ui/PageHeader";
import type { ExamBoardCentreInfo } from "@/lib/exam-boards/centre";
import {
  RegistrationWindowSelectorFields,
  useRegistrationWindowSelector,
} from "@/components/registrations/RegistrationWindowSelector";
import { examDocumentTypeLabel } from "@/lib/exam-documents/labels";
import "@/styles/exam-document-print.css";

type DocumentCategory = "candidate" | "room" | "centre" | "fee";

const DOCUMENT_CATEGORIES: Record<
  DocumentCategory,
  { label: string; types: Array<{ value: string; implemented: boolean }> }
> = {
  candidate: {
    label: "Candidate Documents",
    types: [
      { value: "STATEMENT_OF_ENTRY", implemented: true },
      { value: "CANDIDATE_TIMETABLE", implemented: true },
    ],
  },
  room: {
    label: "Exam Room Documents",
    types: [
      { value: "ATTENDANCE_REGISTER", implemented: true },
      { value: "SEATING_PLAN", implemented: true },
      { value: "DESK_LABELS", implemented: false },
      { value: "CANDIDATE_LABELS", implemented: true },
    ],
  },
  centre: {
    label: "Centre Reports",
    types: [
      { value: "CANDIDATE_LIST", implemented: true },
      { value: "SUBJECT_CANDIDATE_LIST", implemented: false },
      { value: "ROOM_CANDIDATE_LIST", implemented: false },
      { value: "MISSING_CANDIDATE_REPORT", implemented: false },
    ],
  },
  fee: {
    label: "Fee Documents",
    types: [
      { value: "NORMAL_FEE_STATEMENT", implemented: false },
      { value: "RESTRICTED_INVOICE", implemented: true },
    ],
  },
};

const inputClass = "rounded border border-slate-300 px-3 py-2 text-sm";
const buttonClass =
  "rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
const primaryButtonClass =
  "rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";

function centreFromRecord(value: unknown): ExamBoardCentreInfo | null {
  if (!value || typeof value !== "object") return null;
  const centre = value as Record<string, unknown>;
  if (typeof centre.examBoardCode !== "string" || typeof centre.centreName !== "string") {
    return null;
  }
  return centre as unknown as ExamBoardCentreInfo;
}

function CentreHeaderBlock({ centre }: { centre: ExamBoardCentreInfo | null }) {
  if (!centre) return null;
  return <ExamDocumentCentreHeader centre={centre} />;
}

function CandidatePhotoBlock({ photoUrl }: { photoUrl?: unknown }) {
  if (typeof photoUrl !== "string" || !photoUrl) return null;
  return (
    <img
      src={photoUrl}
      alt="Candidate"
      className="mb-3 h-32 w-24 rounded border border-slate-200 object-cover"
    />
  );
}

function IdentityDetailsBlock({ page }: { page: Record<string, unknown> }) {
  return (
    <div className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
      {page.chineseName ? <p>Chinese name: {String(page.chineseName)}</p> : null}
      {page.genderLabel ? <p>Gender: {String(page.genderLabel)}</p> : null}
      {page.dateOfBirth ? <p>Date of birth: {String(page.dateOfBirth)}</p> : null}
      {page.nationality ? <p>Nationality: {String(page.nationality)}</p> : null}
      {page.idDocumentTypeLabel ? <p>ID type: {String(page.idDocumentTypeLabel)}</p> : null}
      {page.idDocumentNumber ? <p>ID number: {String(page.idDocumentNumber)}</p> : null}
      {page.studentNumber ? <p>Student no.: {String(page.studentNumber)}</p> : null}
      {page.grade ? <p>Grade: {String(page.grade)}</p> : null}
      {page.className ? <p>Class: {String(page.className)}</p> : null}
    </div>
  );
}

export function ExamDocumentsManager({ apiBasePath }: { apiBasePath: string }) {
  const [category, setCategory] = useState<DocumentCategory>("candidate");
  const [documentType, setDocumentType] = useState("STATEMENT_OF_ENTRY");
  const [filters, setFilters] = useState({
    registrationWindowId: "",
    examSessionId: "",
    examBoardId: "",
    candidateType: "",
    grade: "",
    className: "",
    subjectId: "",
    room: "",
    date: "",
    candidateSearch: "",
    registrationType: "",
  });
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState("");
  const windowSelector = useRegistrationWindowSelector({ scope: "staff" });

  useEffect(() => {
    setFilters((prev) =>
      prev.registrationWindowId === windowSelector.registrationWindowId
        ? prev
        : { ...prev, registrationWindowId: windowSelector.registrationWindowId },
    );
  }, [windowSelector.registrationWindowId]);

  const currentCategory = DOCUMENT_CATEGORIES[category];
  const selectedType = currentCategory.types.find((type) => type.value === documentType);

  useEffect(() => {
    const first = currentCategory.types[0];
    if (first) setDocumentType(first.value);
  }, [category, currentCategory.types]);

  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("documentType", documentType);
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    return params;
  }, [documentType, filters]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBasePath}/exam-documents?${filterParams.toString()}`);
      const text = await response.text();
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Preview failed");
      }
      setPreview(data);
    } catch (previewError) {
      setPreview(null);
      setError(previewError instanceof Error ? previewError.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, filterParams]);

  async function runAction(action: "preview" | "print" | "download") {
    if (!selectedType?.implemented) {
      setError("This document type is not implemented yet.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBasePath}/exam-documents?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          filters: Object.fromEntries(filterParams.entries()),
          workspaceId: workspaceId || undefined,
        }),
      });
      if (action === "download" && documentType === "CANDIDATE_LIST") {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "candidate-list.csv";
        link.click();
        URL.revokeObjectURL(url);
        return;
      }
      const text = await response.text();
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Action failed");
      }
      setPreview(data);
      if (action === "print") {
        window.print();
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 exam-documents-page">
      <PageHeader
        title="Exam Documents"
        description="Generate exam-office documents. Restricted registrations are excluded from all normal documents."
      />

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Categories
          </p>
          <nav className="space-y-1">
            {(Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`block w-full rounded px-3 py-2 text-left text-sm ${
                  category === key
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-white"
                }`}
              >
                {DOCUMENT_CATEGORIES[key].label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="space-y-4 border border-slate-200 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-slate-700">
              Document type
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className={`mt-1 block ${inputClass}`}
              >
                {currentCategory.types.map((type) => (
                  <option key={type.value} value={type.value}>
                    {examDocumentTypeLabel(type.value)}
                    {type.implemented ? "" : " (Coming soon)"}
                  </option>
                ))}
              </select>
            </label>
            {documentType === "RESTRICTED_INVOICE" ? (
              <label className="text-sm text-slate-700">
                Workspace ID
                <input
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  className={`mt-1 block ${inputClass}`}
                  placeholder="Restricted registration workspace"
                />
              </label>
            ) : null}
          </div>

          <RegistrationWindowSelectorFields
            state={{
              ...windowSelector,
              setRegistrationWindowId: (id) => {
                windowSelector.setRegistrationWindowId(id);
                setFilters((prev) => ({ ...prev, registrationWindowId: id }));
              },
            }}
            layout="inline"
            className="sm:col-span-2 lg:col-span-4"
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              placeholder="Exam session ID"
              value={filters.examSessionId}
              onChange={(e) => setFilters((prev) => ({ ...prev, examSessionId: e.target.value }))}
              className={inputClass}
            />
            <input
              placeholder="Exam board ID"
              value={filters.examBoardId}
              onChange={(e) => setFilters((prev) => ({ ...prev, examBoardId: e.target.value }))}
              className={inputClass}
            />
            <input
              placeholder="Grade"
              value={filters.grade}
              onChange={(e) => setFilters((prev) => ({ ...prev, grade: e.target.value }))}
              className={inputClass}
            />
            <input
              placeholder="Class"
              value={filters.className}
              onChange={(e) => setFilters((prev) => ({ ...prev, className: e.target.value }))}
              className={inputClass}
            />
            <input
              placeholder="Room / venue"
              value={filters.room}
              onChange={(e) => setFilters((prev) => ({ ...prev, room: e.target.value }))}
              className={inputClass}
            />
            <input
              placeholder="Date (YYYY-MM-DD)"
              value={filters.date}
              onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
              className={inputClass}
            />
            <input
              placeholder="Candidate search"
              value={filters.candidateSearch}
              onChange={(e) => setFilters((prev) => ({ ...prev, candidateSearch: e.target.value }))}
              className={inputClass}
            />
            <select
              value={filters.candidateType}
              onChange={(e) => setFilters((prev) => ({ ...prev, candidateType: e.target.value }))}
              className={inputClass}
            >
              <option value="">All candidate types</option>
              <option value="INTERNAL">Internal</option>
              <option value="EXTERNAL">External</option>
            </select>
            {documentType !== "RESTRICTED_INVOICE" ? (
              <select
                value={filters.registrationType}
                onChange={(e) => setFilters((prev) => ({ ...prev, registrationType: e.target.value }))}
                className={inputClass}
              >
                <option value="">Normal docs (excludes Restricted)</option>
                <option value="NORMAL">Normal only</option>
                <option value="EXTERNAL">External only</option>
              </select>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadPreview()} disabled={loading} className={buttonClass}>
              Preview
            </button>
            <button
              type="button"
              onClick={() => void runAction("print")}
              disabled={loading || !selectedType?.implemented}
              className={primaryButtonClass}
            >
              Print
            </button>
            {documentType === "CANDIDATE_LIST" ? (
              <button
                type="button"
                onClick={() => void runAction("download")}
                disabled={loading}
                className={buttonClass}
              >
                Export Excel/CSV
              </button>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div id="exam-document-print-root" className="exam-document-print-root">
            {loading && !preview ? <p className="text-sm text-slate-500">Loading...</p> : null}
            {preview?.comingSoon ? (
              <p className="text-sm text-slate-600">This document type is coming soon.</p>
            ) : null}
            {Array.isArray(preview?.pages) ? (
              <div className="space-y-6">
                {(preview.pages as Record<string, unknown>[]).map((page, index) => (
                  <section key={index} className="exam-document-page border border-slate-200 p-4">
                    <CentreHeaderBlock centre={centreFromRecord(page.centre)} />
                    <div className="flex flex-wrap gap-4">
                      <CandidatePhotoBlock photoUrl={page.photoUrl} />
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                          {String(page.documentTitle ?? documentType)}
                        </h2>
                        <p className="text-sm text-slate-700">
                          {String(page.candidateName ?? "")} · {String(page.candidateNumber ?? "")}
                          {page.centreNumber ? ` · Centre ${String(page.centreNumber)}` : ""}
                        </p>
                        <IdentityDetailsBlock page={page} />
                      </div>
                    </div>
                    {Array.isArray(page.entries) ? (
                      <table className="mt-3 w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                            <th className="border border-slate-200 px-2 py-1">Subject</th>
                            <th className="border border-slate-200 px-2 py-1">Paper</th>
                            <th className="border border-slate-200 px-2 py-1">Date</th>
                            <th className="border border-slate-200 px-2 py-1">Time</th>
                            <th className="border border-slate-200 px-2 py-1">Room</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(page.entries as Record<string, string>[]).map((entry, rowIndex) => (
                            <tr key={rowIndex}>
                              <td className="border border-slate-200 px-2 py-1">{entry.subject}</td>
                              <td className="border border-slate-200 px-2 py-1">
                                {entry.paperCode} {entry.paperTitle}
                              </td>
                              <td className="border border-slate-200 px-2 py-1">{entry.date}</td>
                              <td className="border border-slate-200 px-2 py-1">{entry.time}</td>
                              <td className="border border-slate-200 px-2 py-1">{entry.room}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}
                    {Array.isArray(page.days) ? (
                      <div className="mt-3 space-y-3">
                        {(page.days as Array<{ date: string; entries: Record<string, string>[] }>).map(
                          (day) => (
                            <div key={day.date}>
                              <h3 className="font-medium text-slate-900">{day.date}</h3>
                              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                                {day.entries.map((entry, entryIndex) => (
                                  <li key={entryIndex}>
                                    {entry.time} · {entry.subject} · {entry.paperCode} · {entry.room}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ),
                        )}
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            ) : null}

            {Array.isArray(preview?.registers) ? (
              <div className="space-y-6">
                {(preview.registers as Record<string, unknown>[]).map((register, index) => (
                  <section key={index} className="exam-document-page border border-slate-200 p-4">
                    <CentreHeaderBlock centre={centreFromRecord(register.centre)} />
                    <h2 className="text-lg font-semibold">Attendance Register</h2>
                    <p className="text-sm text-slate-700">
                      {String(register.subject)} · {String(register.paperCode)} · {String(register.date)}{" "}
                      {String(register.time)} · Room {String(register.room)}
                    </p>
                    <table className="mt-3 w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                          <th className="border px-2 py-1">Seat</th>
                          <th className="border px-2 py-1">Photo</th>
                          <th className="border px-2 py-1">Candidate No.</th>
                          <th className="border px-2 py-1">Name</th>
                          <th className="border px-2 py-1">Class</th>
                          <th className="border px-2 py-1">Present</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(register.rows as Record<string, string>[]).map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            <td className="border px-2 py-1">{row.seat}</td>
                            <td className="border px-2 py-1">
                              {row.photoUrl ? (
                                <img
                                  src={String(row.photoUrl)}
                                  alt=""
                                  className="h-10 w-8 rounded object-cover"
                                />
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="border px-2 py-1">{row.candidateNumber}</td>
                            <td className="border px-2 py-1">{row.candidateName}</td>
                            <td className="border px-2 py-1">{row.className}</td>
                            <td className="border px-2 py-1">&nbsp;</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            ) : null}

            {Array.isArray(preview?.plans) ? (
              <div className="space-y-6">
                {(preview.plans as Record<string, unknown>[]).map((plan, index) => (
                  <section key={index} className="exam-document-page border border-slate-200 p-4">
                    <CentreHeaderBlock centre={centreFromRecord(plan.centre)} />
                    <h2 className="text-lg font-semibold">Seating Plan</h2>
                    <p className="text-sm text-slate-700">
                      {String(plan.room)} · {String(plan.date)} {String(plan.time)}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(plan.seats as Record<string, string>[]).map((seat, seatIndex) => (
                        <div key={seatIndex} className="border border-slate-300 p-2 text-sm">
                          <div className="font-medium">Seat {seat.seat}</div>
                          <div>{seat.candidateName}</div>
                          <div className="text-slate-600">{seat.candidateNumber}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}

            {Array.isArray(preview?.labels) ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(preview.labels as Record<string, unknown>[]).map((label, index) => (
                  <section key={index} className="exam-document-page border border-slate-200 p-4">
                    <CentreHeaderBlock centre={centreFromRecord(label.centre)} />
                    <div className="flex items-start gap-3">
                      <CandidatePhotoBlock photoUrl={label.photoUrl} />
                      <div className="text-sm">
                        <h2 className="font-semibold text-slate-900">{String(label.candidateName)}</h2>
                        {label.chineseName ? (
                          <p className="text-slate-600">{String(label.chineseName)}</p>
                        ) : null}
                        <p className="mt-1 font-mono text-slate-700">{String(label.candidateNumber)}</p>
                        <p className="text-slate-600">
                          {String(label.grade ?? "—")} · {String(label.className ?? "—")}
                        </p>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            ) : null}

            {Array.isArray(preview?.rows) ? (
              <div className="overflow-x-auto">
                <CentreHeaderBlock centre={centreFromRecord(preview.centre)} />
                <table className="min-w-full border-collapse border border-slate-200 text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                      <th className="border px-2 py-1">Centre No.</th>
                      <th className="border px-2 py-1">Candidate No.</th>
                      <th className="border px-2 py-1">Student No.</th>
                      <th className="border px-2 py-1">Name</th>
                      <th className="border px-2 py-1">Grade</th>
                      <th className="border px-2 py-1">Class</th>
                      <th className="border px-2 py-1">Subjects</th>
                      <th className="border px-2 py-1">Papers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.rows as Record<string, string | number>[]).map((row, index) => (
                      <tr key={index}>
                        <td className="border px-2 py-1">{row.centreNumber}</td>
                        <td className="border px-2 py-1">{row.candidateNumber}</td>
                        <td className="border px-2 py-1">{row.studentNumber}</td>
                        <td className="border px-2 py-1">{row.candidateName}</td>
                        <td className="border px-2 py-1">{row.grade}</td>
                        <td className="border px-2 py-1">{row.className}</td>
                        <td className="border px-2 py-1">{row.subjects}</td>
                        <td className="border px-2 py-1">{row.paperCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {preview?.invoice ? (
              <section className="exam-document-page border border-slate-200 p-4">
                <CentreHeaderBlock centre={centreFromRecord((preview.invoice as Record<string, unknown>).centre)} />
                <h2 className="text-lg font-semibold">Restricted Invoice</h2>
                <p className="mt-2 text-sm text-slate-700">
                  Statement no. {String((preview.invoice as Record<string, unknown>).statementNo ?? "")}
                </p>
                <pre className="mt-2 overflow-x-auto text-xs text-slate-700">
                  {JSON.stringify(preview.invoice, null, 2)}
                </pre>
              </section>
            ) : null}

            {preview && typeof preview.registrationCount === "number" ? (
              <p className="text-sm text-slate-600">
                {preview.registrationCount} registration row(s) matched (restricted registrations excluded from normal documents).
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
