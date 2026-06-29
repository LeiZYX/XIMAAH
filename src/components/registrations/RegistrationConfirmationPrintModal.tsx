"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { auditActionLabel } from "@/lib/registrations/audit-labels";
import {
  formatAdjusterLabel,
  parseAdjustmentSummary,
  type AdjustmentSummaryPayload,
} from "@/lib/registrations/workspace-display";
import {
  formatAdjustmentAttribution,
  formatAdjustmentHeading,
  resolvePostLockAdjustmentHistory,
  type AdjustmentHistoryBatch,
} from "@/lib/registrations/adjustment-history";
import {
  formatDuration,
  formatExamDate,
  formatExamSessionLabel,
  formatWindowRange,
  getGroupLockedOn,
  getStudentSnapshotFromRegistrations,
  sortRegistrationsForPrint,
  type RegistrationWindowGroup,
  type StudentRegistrationRow,
} from "@/lib/registrations/student-groups";
import "@/styles/registration-print.css";

const PARTNERSHIP_LOGO = "/logos/shssip-rugby-logo.png";

export interface ConfirmationPrintData {
  group: RegistrationWindowGroup;
  workspaceId?: string;
  hasPostLockAdjustment?: boolean;
  lastAdjustedAt?: string | null;
  lastAdjustedByName?: string | null;
  lastAdjustedByRole?: string | null;
  lastAdjustmentReason?: string | null;
  lastAdjustmentSummary?: AdjustmentSummaryPayload | null;
  postLockAdjustments?: AdjustmentHistoryBatch[];
  isLateRegistration?: boolean;
  examBoardIdentities?: Array<{
    examBoardName: string;
    examBoardCode: string;
    boardCandidateNumber?: string | null;
    uci?: string | null;
    centreNumber?: string | null;
  }>;
}

interface RegistrationConfirmationPrintModalProps {
  data: ConfirmationPrintData;
  onClose: () => void;
}

function PrintIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" />
    </svg>
  );
}

export function RegistrationPrintButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label="Print registration confirmation" title="Print registration confirmation" className={className ?? "rounded-lg p-2 text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-50"}>
      <PrintIcon className="h-4 w-4" />
    </button>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function ExamLineText(item: { subject: string; paperCode: string; paperTitle: string }) {
  return `${item.subject} — ${item.paperCode}${item.paperTitle ? ` ${item.paperTitle}` : ""}`;
}

export function buildPrintDocumentTitle(data: ConfirmationPrintData, at = new Date()): string {
  const student = getStudentSnapshotFromRegistrations(data.group.registrations);
  const registrationName = data.group.window.title || data.group.examSeries.name;
  const ymd = [
    at.getFullYear(),
    String(at.getMonth() + 1).padStart(2, "0"),
    String(at.getDate()).padStart(2, "0"),
  ].join("");
  const timestamp = [
    ymd,
    String(at.getHours()).padStart(2, "0"),
    String(at.getMinutes()).padStart(2, "0"),
  ].join("");
  const sanitize = (value: string) =>
    value.replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  return `${sanitize(student.name)}-${ymd}-${sanitize(registrationName)}-${timestamp}`;
}

function candidateTypeLabel(value: string): string {
  switch (value) {
    case "INTERNAL":
      return "Internal (school student)";
    case "EXTERNAL":
      return "External candidate";
    default:
      return value;
  }
}

function ConfirmationDocument({ data, printTimestamp }: { data: ConfirmationPrintData; printTimestamp: Date }) {
  const { group } = data;
  const student = getStudentSnapshotFromRegistrations(group.registrations);
  const isInternal = student.candidateType === "INTERNAL";
  const lockedOn = getGroupLockedOn(group.registrations);
  const exams = sortRegistrationsForPrint(group.registrations);
  const postLockAdjustments = data.postLockAdjustments ?? [];
  const showAdjustments = Boolean(data.hasPostLockAdjustment && postLockAdjustments.length > 0);
  const lastBatch = postLockAdjustments[postLockAdjustments.length - 1];
  const adjuster = lastBatch
    ? formatAdjustmentAttribution(lastBatch)
    : formatAdjusterLabel(data.lastAdjustedByName, data.lastAdjustedByRole as never);

  return (
    <div id="registration-print-document" className="mx-auto max-w-[210mm] rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="registration-print-header border-b border-slate-200 px-6 py-4">
        <div className="flex items-start gap-4">
          <Image
            src={PARTNERSHIP_LOGO}
            alt="SHSSIP in partnership with Rugby School"
            width={320}
            height={72}
            className="h-14 w-auto max-w-[280px] object-contain object-left"
            priority
            unoptimized
          />
          <div className="flex-1 border-l border-indigo-100 pl-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">XIMA Assessment Hub</p>
            <h3 className="text-xl font-semibold text-slate-900">Exam Registration Confirmation</h3>
            <p className="mt-1 text-sm text-slate-500">Printed {printTimestamp.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="registration-print-body space-y-5 px-6 py-5">
        <section>
          <h4 className="border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-indigo-700">Candidate Information</h4>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <SummaryField label="Candidate Name" value={student.name} />
            <SummaryField label="Assessment Hub Candidate No." value={student.assessmentHubCandidateNumber} />
            <SummaryField label="Candidate Type" value={candidateTypeLabel(student.candidateType)} />
            {isInternal ? (
              <>
                <SummaryField label="Grade" value={student.grade} />
                <SummaryField label="Class" value={student.className} />
                <SummaryField label="Student Number" value={student.studentNo} />
              </>
            ) : null}
            <SummaryField label="Email Address" value={student.email} />
          </dl>
          {data.examBoardIdentities && data.examBoardIdentities.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Exam board identities</p>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="py-1 pr-3">Exam board</th>
                    <th className="py-1 pr-3">Board candidate no.</th>
                    <th className="py-1 pr-3">UCI</th>
                    <th className="py-1">Centre no.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.examBoardIdentities.map((identity) => (
                    <tr key={identity.examBoardCode} className="border-b border-slate-100">
                      <td className="py-1.5 pr-3">{identity.examBoardName}</td>
                      <td className="py-1.5 pr-3">{identity.boardCandidateNumber ?? "—"}</td>
                      <td className="py-1.5 pr-3">{identity.uci ?? "—"}</td>
                      <td className="py-1.5">{identity.centreNumber ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section>
          <h4 className="border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-indigo-700">Registration Summary</h4>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <SummaryField label="Exam Board" value={group.boardSummary} />
            <SummaryField label="Registration Name" value={group.window.title || group.examSeries.name} />
            <SummaryField label="Exam Series" value={`${group.examSeries.name} (${group.examSeries.year})`} />
            <SummaryField label="Registration Window" value={formatWindowRange(group.window.studentRegistrationOpenAt, group.window.registrationCloseAt)} />
            <SummaryField label="Status" value="Locked" />
            <SummaryField label="Selected Exams" value={String(group.registrations.length)} />
            <SummaryField label="Locked On" value={lockedOn ? new Date(lockedOn).toLocaleString() : "—"} />
            <SummaryField label="Last Updated" value={new Date(group.lastUpdatedAt).toLocaleString()} />
            {data.hasPostLockAdjustment ? (
              <>
                <SummaryField label="Adjusted By" value={adjuster} />
                <SummaryField label="Adjusted On" value={data.lastAdjustedAt ? new Date(data.lastAdjustedAt).toLocaleString() : "—"} />
              </>
            ) : null}
          </dl>
        </section>

        <section>
          <h4 className="border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-indigo-700">Selected Exams</h4>
          <div className="mt-3 overflow-x-auto">
            <table className="registration-print-table w-full border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-indigo-50 text-indigo-900">
                  {["Subject", "Paper Code", "Paper Title", "Exam Date", "Exam Time", "Duration", "Session"].map((col) => (
                    <th key={col} className="border border-slate-200 px-2 py-2 font-semibold">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam.id} className="even:bg-slate-50/80">
                    <td className="border border-slate-200 px-2 py-2">{exam.subject.name}</td>
                    <td className="border border-slate-200 px-2 py-2 font-medium">{exam.paper.code}</td>
                    <td className="border border-slate-200 px-2 py-2">{exam.paper.title || "—"}</td>
                    <td className="border border-slate-200 px-2 py-2">{formatExamDate(exam.examSession.date)}</td>
                    <td className="border border-slate-200 px-2 py-2">{exam.examSession.startTime ?? "—"}</td>
                    <td className="border border-slate-200 px-2 py-2">{formatDuration(exam.paper.duration)}</td>
                    <td className="border border-slate-200 px-2 py-2">{formatExamSessionLabel(exam.examSession)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {showAdjustments ? (
          <section>
            <h4 className="border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-indigo-700">Adjustment Summary</h4>
            <div className="mt-3 space-y-5 text-sm text-slate-800">
              {postLockAdjustments.map((batch, index) => (
                <div key={`${batch.adjustedAt}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
                  <p className="font-medium text-indigo-900">
                    {formatAdjustmentHeading(batch, index, postLockAdjustments.length)}
                  </p>
                  {batch.added.length > 0 ? (
                    <div className="mt-2">
                      <p className="font-medium">Added:</p>
                      <ul className="mt-1 list-disc pl-5">{batch.added.map((item, i) => <li key={`a-${index}-${i}`}>{ExamLineText(item)}</li>)}</ul>
                    </div>
                  ) : null}
                  {batch.removed.length > 0 ? (
                    <div className="mt-2">
                      <p className="font-medium">Removed:</p>
                      <ul className="mt-1 list-disc pl-5">{batch.removed.map((item, i) => <li key={`r-${index}-${i}`}>{ExamLineText(item)}</li>)}</ul>
                    </div>
                  ) : null}
                  {batch.replaced.length > 0 ? (
                    <div className="mt-2">
                      <p className="font-medium">Replaced:</p>
                      <ul className="mt-1 list-disc pl-5">
                        {batch.replaced.map((item, i) => (
                          <li key={`p-${index}-${i}`}>{ExamLineText(item.from)} → {ExamLineText(item.to)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {batch.reason ? (
                    <div className="mt-2">
                      <p className="font-medium">Reason:</p>
                      <p className="mt-1 whitespace-pre-wrap">{batch.reason}</p>
                    </div>
                  ) : null}
                  <p className="mt-2"><span className="font-medium">Adjusted By:</span> {formatAdjustmentAttribution(batch)}</p>
                  <p><span className="font-medium">Adjusted On:</span> {new Date(batch.adjustedAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {data.isLateRegistration ? (
          <section className="rounded-lg border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950">
            <p className="font-medium">This registration was added after the deadline by the Exams Office.</p>
            {data.lastAdjustmentReason ? (
              <p className="mt-1"><span className="font-medium">Reason:</span> {data.lastAdjustmentReason}</p>
            ) : null}
            {adjuster !== "—" ? (
              <p className="mt-1"><span className="font-medium">Created by:</span> {adjuster}</p>
            ) : null}
            {data.lastAdjustedAt ? (
              <p className="mt-1"><span className="font-medium">Created on:</span> {new Date(data.lastAdjustedAt).toLocaleString()}</p>
            ) : null}
          </section>
        ) : null}

        {data.hasPostLockAdjustment || data.isLateRegistration ? (
          <section className="registration-print-keep-together border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-800">I have checked the above registration details and confirm that they are correct.</p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-slate-600">Student Signature:</p>
                <div className="mt-8 border-b border-slate-400" />
              </div>
              <div>
                <p className="text-slate-600">Date:</p>
                <div className="mt-8 border-b border-slate-400" />
              </div>
            </div>
          </section>
        ) : null}

        <section className="registration-print-keep-together rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-950">
          <p className="font-medium">This registration is locked. No further changes can be made by the student.</p>
          <p className="mt-1 text-indigo-900/80">If you have any questions, please contact the Exams Office.</p>
        </section>
      </div>
    </div>
  );
}

export function buildConfirmationPrintData(
  group: RegistrationWindowGroup,
  workspace?: {
    id?: string;
    hasPostLockAdjustment?: boolean;
    lastAdjustedAt?: string | Date | null;
    lastAdjustedByUser?: { name?: string | null } | null;
    lastAdjustedByRole?: string | null;
    lastAdjustmentReason?: string | null;
    lastAdjustmentSummary?: string | null;
    auditLogs?: Array<{
      action: string;
      performedAt: string;
      reason: string | null;
      note: string | null;
      performedBy: { name: string; role?: string | null };
      performedByRole?: string | null;
      examSession?: {
        paper: { code: string; title: string; subject: { name: string } };
      } | null;
    }>;
  } | null,
): ConfirmationPrintData {
  const lastAdjustedByName = workspace?.lastAdjustedByUser?.name ?? null;
  const postLockAdjustments = resolvePostLockAdjustmentHistory({
    auditLogs: workspace?.auditLogs,
    lastAdjustmentSummary: workspace?.lastAdjustmentSummary,
    lastAdjustedAt: workspace?.lastAdjustedAt,
    lastAdjustedByName,
    lastAdjustedByRole: workspace?.lastAdjustedByRole,
    lastAdjustmentReason: workspace?.lastAdjustmentReason,
  });

  return {
    group,
    workspaceId: workspace?.id,
    hasPostLockAdjustment: workspace?.hasPostLockAdjustment ?? postLockAdjustments.length > 0,
    lastAdjustedAt: workspace?.lastAdjustedAt ? String(workspace.lastAdjustedAt) : null,
    lastAdjustedByName,
    lastAdjustedByRole: workspace?.lastAdjustedByRole ?? null,
    lastAdjustmentReason: workspace?.lastAdjustmentReason ?? null,
    lastAdjustmentSummary: parseAdjustmentSummary(workspace?.lastAdjustmentSummary),
    postLockAdjustments,
    isLateRegistration:
      (workspace as { isLateRegistration?: boolean } | null)?.isLateRegistration ??
      group.isLateRegistration,
  };
}

export function rowsToWindowGroup(
  registrations: StudentRegistrationRow[],
  workspaceMeta?: ConfirmationPrintData,
): RegistrationWindowGroup | null {
  if (registrations.length === 0) return null;
  const window = registrations[0].registrationWindow;
  const examSeries = registrations[0].examSeries;
  const lastUpdatedAt = registrations.reduce(
    (latest, row) => (new Date(row.updatedAt) > new Date(latest) ? row.updatedAt : latest),
    registrations[0].updatedAt,
  );
  const boards = [...new Set(registrations.map((r) => r.examBoard.name))];
  return {
    windowId: window.id,
    window,
    examSeries,
    registrations,
    lastUpdatedAt,
    cardStatus: "Locked",
    boardSummary: boards.length === 1 ? boards[0] : boards.length > 1 ? "Mixed exam boards" : "—",
    ...workspaceMeta,
  } as RegistrationWindowGroup;
}

export function RegistrationConfirmationPrintModal({ data, onClose }: RegistrationConfirmationPrintModalProps) {
  const [mounted, setMounted] = useState(false);
  const printTimestamp = useMemo(() => new Date(), []);
  const savedTitleRef = useMemo(() => ({ value: "" }), []);

  const cleanupPrintClone = useCallback(() => {
    document.body.classList.remove("registration-print-active");
    document.getElementById("registration-print-clone")?.remove();
    if (savedTitleRef.value) {
      document.title = savedTitleRef.value;
      savedTitleRef.value = "";
    }
  }, [savedTitleRef]);

  const handlePrint = useCallback(() => {
    const source = document.getElementById("registration-print-document");
    if (!source) return;
    cleanupPrintClone();
    const clone = source.cloneNode(true) as HTMLElement;
    clone.id = "registration-print-clone";
    document.body.appendChild(clone);
    document.body.classList.add("registration-print-active");
    savedTitleRef.value = document.title;
    document.title = buildPrintDocumentTitle(data, printTimestamp);
    window.print();
  }, [cleanupPrintClone, data, printTimestamp, savedTitleRef]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onAfterPrint = () => cleanupPrintClone();
    window.addEventListener("afterprint", onAfterPrint);
    return () => { window.removeEventListener("afterprint", onAfterPrint); cleanupPrintClone(); };
  }, [cleanupPrintClone]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="registration-print-no-print fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" aria-hidden />
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="registration-print-no-print flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Print Registration Confirmation</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        <div className="overflow-y-auto bg-slate-100 px-4 py-6 sm:px-8">
          <ConfirmationDocument data={data} printTimestamp={printTimestamp} />
        </div>
        <div className="registration-print-no-print flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={handlePrint} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <PrintIcon className="h-4 w-4" /> Print
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export { auditActionLabel };
