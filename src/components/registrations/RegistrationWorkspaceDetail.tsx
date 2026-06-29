"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  auditActionLabel,
  buildConfirmationPrintData,
  RegistrationConfirmationPrintModal,
} from "@/components/registrations/RegistrationConfirmationPrintModal";
import {
  formatAdjusterLabel,
  parseAdjustmentSummary,
} from "@/lib/registrations/workspace-display";
import {
  formatDuration,
  formatExamDate,
  formatExamSessionLabel,
  formatWindowRange,
  getGroupLockedOn,
} from "@/lib/registrations/student-groups";
import {
  formatExamSessionSummary,
  changeRequestTypeLabel,
  changeRequestStatusLabel,
} from "@/components/registrations/TeacherChangeRequestModal";
import {
  EXAM_SESSION_PREVIEW_LIMIT,
  EXAM_SESSION_SEARCH_LIMIT,
  formatExamSessionOptionLabel,
  limitExamSessions,
  type ExamSessionSearchable,
} from "@/lib/exam-session-search";
import { FeeStatementPanel } from "@/components/fees/FeeStatementPanel";

interface WorkspaceDetailProps {
  workspaceId: string;
  apiBase: string;
  backHref: string;
  canAdjust?: boolean;
  feeRulesHrefBase?: "/admin/registration-windows" | "/exam-office/registration-windows";
}

interface ExamSessionOption extends ExamSessionSearchable {
  paper: ExamSessionSearchable["paper"] & { duration?: number | null };
}

function ExamSessionSearchPicker({
  sessions,
  loading,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  placeholder,
}: {
  sessions: ExamSessionOption[];
  loading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder: string;
}) {
  const { items: visibleSessions, truncated } = useMemo(
    () => limitExamSessions(sessions, query),
    [sessions, query],
  );
  const selectedSession = sessions.find((session) => session.id === selectedId) ?? null;
  const hasQuery = query.trim().length > 0;
  const previewMaybeMore = !hasQuery && sessions.length >= EXAM_SESSION_PREVIEW_LIMIT;
  const searchMaybeMore = hasQuery && (truncated || sessions.length >= EXAM_SESSION_SEARCH_LIMIT);

  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {selectedSession ? (
        <p className="text-sm text-indigo-700">
          Selected: {formatExamSessionOptionLabel(selectedSession)}
        </p>
      ) : null}
      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <p className="px-3 py-2 text-sm text-slate-500">Loading exam sessions...</p>
        ) : visibleSessions.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-500">
            {hasQuery ? `No sessions match "${query.trim()}".` : "No exam sessions available."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleSessions.map((session) => {
              const active = session.id === selectedId;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(session.id)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                      active ? "bg-indigo-50 font-medium text-indigo-800" : "text-slate-800"
                    }`}
                  >
                    {formatExamSessionOptionLabel(session)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {!loading && visibleSessions.length > 0 ? (
        <p className="text-xs text-slate-500">
          {hasQuery
            ? searchMaybeMore
              ? `Showing first ${EXAM_SESSION_SEARCH_LIMIT} matches. Refine your search to narrow results.`
              : `Showing ${visibleSessions.length} match${visibleSessions.length === 1 ? "" : "es"}.`
            : previewMaybeMore
              ? `Showing ${visibleSessions.length} sessions. Search by subject, paper code, or title to find more.`
              : `Showing ${visibleSessions.length} session${visibleSessions.length === 1 ? "" : "s"}.`}
        </p>
      ) : null}
    </div>
  );
}

interface WorkspaceData {
  id: string;
  lockedAt: string | null;
  hasPostLockAdjustment: boolean;
  lastAdjustedAt: string | null;
  lastAdjustmentReason: string | null;
  lastAdjustmentSummary: string | null;
  lastAdjustedByRole: string | null;
  lastAdjustedByUser: { name: string } | null;
  student: {
    name: string;
    email: string | null;
    studentProfile: { studentNo: string; currentGrade: string; currentClassName: string; email: string | null } | null;
  } | null;
  candidate?: {
    englishName: string;
    studentNumber: string | null;
    grade: string | null;
    className: string | null;
    email: string | null;
    assessmentHubCandidateNumber: string;
    candidateType: string;
    examIdentities?: Array<{
      boardCandidateNumber: string | null;
      uci: string | null;
      centreNumber: string | null;
      examBoard: { name: string; code: string };
    }>;
  } | null;
  registrationWindow: {
    id: string;
    title: string;
    studentRegistrationOpenAt: string;
    studentRegistrationCloseAt: string;
    registrationCloseAt: string;
    examBoard: { name: string };
    examSeries: { id: string; name: string; year: number };
  };
  registrations: Array<{
    id: string;
    updatedAt: string;
    lockedAt: string | null;
    studentNameSnapshot?: string;
    studentNoSnapshot?: string;
    gradeSnapshot?: string;
    classNameSnapshot?: string;
    emailSnapshot?: string | null;
    assessmentHubCandidateNumberSnapshot?: string | null;
    candidateTypeSnapshot?: string | null;
    examSession: {
      id: string;
      date: string;
      startTime: string | null;
      endTime: string | null;
      venue: string | null;
      paper: { code: string; title: string; duration: number | null; subject: { name: string } };
    };
    subject: { name: string };
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    performedAt: string;
    reason: string | null;
    note: string | null;
    performedByRole?: string | null;
    performedBy: { name: string; role?: string | null };
    examSession?: {
      paper: { code: string; title: string; subject: { name: string } };
    } | null;
  }>;
  changeRequests: Array<{
    id: string;
    requestType: string;
    status: string;
    reason: string;
    createdAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
    requestedByRole: string;
    targetRegistrationId: string | null;
    requestedBy: { name: string; role?: string };
    reviewedBy: { name: string } | null;
    targetExamSession: {
      date: string;
      startTime: string | null;
      paper: { code: string; title: string; subject: { name: string } };
    } | null;
    replacementExamSession: {
      date: string;
      startTime: string | null;
      paper: { code: string; title: string; subject: { name: string } };
    } | null;
    examSessions?: Array<{
      examSession: {
        date: string;
        startTime: string | null;
        paper: { code: string; title: string; subject: { name: string } };
      };
    }>;
  }>;
}

export function RegistrationWorkspaceDetail({
  workspaceId,
  apiBase,
  backHref,
  canAdjust = true,
  feeRulesHrefBase = "/admin/registration-windows",
}: WorkspaceDetailProps) {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [adjustMode, setAdjustMode] = useState<"add" | "remove" | "replace" | null>(null);
  const [reason, setReason] = useState("");
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessions, setSessions] = useState<ExamSessionOption[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedRegistrationId, setSelectedRegistrationId] = useState("");
  const [replacementSessionId, setReplacementSessionId] = useState("");
  const [pendingAdd, setPendingAdd] = useState<string[]>([]);
  const [pendingRemove, setPendingRemove] = useState<string[]>([]);
  const [pendingReplace, setPendingReplace] = useState<Array<{ registrationId: string; newExamSessionId: string }>>([]);
  const [applying, setApplying] = useState(false);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [feeStatementRefreshKey, setFeeStatementRefreshKey] = useState(0);
  const [feeNeedsRegeneration, setFeeNeedsRegeneration] = useState(false);
  const [feeHasIssuedStatement, setFeeHasIssuedStatement] = useState(false);
  const [confirmFeeImpact, setConfirmFeeImpact] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/${workspaceId}`);
      if (!response.ok) throw new Error("Failed to load registration");
      setWorkspace(await response.json());
    } catch {
      setError("Could not load registration workspace.");
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, [apiBase, workspaceId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!workspace || !adjustMode || (adjustMode !== "add" && adjustMode !== "replace")) return;

    const seriesId = workspace.registrationWindow.examSeries.id;
    const handle = window.setTimeout(() => {
      setSessionsLoading(true);
      const params = new URLSearchParams({ examSeriesId: seriesId });
      const q = sessionQuery.trim();
      if (q) {
        params.set("q", q);
        params.set("limit", String(EXAM_SESSION_SEARCH_LIMIT));
      } else {
        params.set("limit", String(EXAM_SESSION_PREVIEW_LIMIT));
      }

      fetch(`/api/exam-sessions?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => setSessions(Array.isArray(data) ? data : []))
        .catch(() => setSessions([]))
        .finally(() => setSessionsLoading(false));
    }, 250);

    return () => window.clearTimeout(handle);
  }, [workspace, adjustMode, sessionQuery]);

  function switchAdjustMode(mode: "add" | "remove" | "replace") {
    setAdjustMode(mode);
    setSessionQuery("");
    setSelectedSessionId("");
    setSelectedRegistrationId("");
    setReplacementSessionId("");
  }

  const isLocked = Boolean(workspace?.lockedAt || workspace?.registrations.every((r) => r.lockedAt));
  const lockedOn = workspace ? getGroupLockedOn(workspace.registrations.map((r) => ({ lockedAt: r.lockedAt } as never))) : null;
  const lastUpdated = workspace?.registrations.reduce(
    (latest, row) => (new Date(row.updatedAt) > new Date(latest) ? row.updatedAt : latest),
    workspace?.registrations[0]?.updatedAt ?? new Date().toISOString(),
  );

  const printData = useMemo(() => {
    if (!workspace) return null;
    const candidate = workspace.candidate;
    const profile = workspace.student?.studentProfile;
    const firstReg = workspace.registrations[0];
    const studentSnapshots = {
      studentNameSnapshot:
        firstReg?.studentNameSnapshot ?? candidate?.englishName ?? workspace.student?.name ?? "",
      studentNoSnapshot:
        firstReg?.studentNoSnapshot ?? candidate?.studentNumber ?? profile?.studentNo ?? "",
      gradeSnapshot: firstReg?.gradeSnapshot ?? candidate?.grade ?? profile?.currentGrade ?? "",
      classNameSnapshot:
        firstReg?.classNameSnapshot ?? candidate?.className ?? profile?.currentClassName ?? "",
      emailSnapshot:
        firstReg?.emailSnapshot ??
        candidate?.email ??
        profile?.email ??
        workspace.student?.email ??
        null,
      assessmentHubCandidateNumberSnapshot:
        firstReg?.assessmentHubCandidateNumberSnapshot ??
        candidate?.assessmentHubCandidateNumber ??
        null,
      candidateTypeSnapshot:
        firstReg?.candidateTypeSnapshot ?? candidate?.candidateType ?? null,
    };
    const examBoardIdentities =
      candidate?.examIdentities?.map((identity) => ({
        examBoardName: identity.examBoard.name,
        examBoardCode: identity.examBoard.code,
        boardCandidateNumber: identity.boardCandidateNumber,
        uci: identity.uci,
        centreNumber: identity.centreNumber,
      })) ?? [];
    const group = {
      windowId: workspace.registrationWindow.id,
      workspaceId: workspace.id,
      window: {
        id: workspace.registrationWindow.id,
        title: workspace.registrationWindow.title,
        status: "CLOSED",
        startAt: workspace.registrationWindow.studentRegistrationOpenAt,
        endAt: workspace.registrationWindow.registrationCloseAt,
      },
      examSeries: workspace.registrationWindow.examSeries,
      registrations: workspace.registrations.map((row) => ({
        id: row.id,
        status: "LOCKED",
        updatedAt: row.updatedAt,
        lockedAt: row.lockedAt,
        ...studentSnapshots,
        examBoard: workspace.registrationWindow.examBoard,
        examSeries: workspace.registrationWindow.examSeries,
        subject: row.subject,
        paper: row.examSession.paper,
        examSession: row.examSession,
        registrationWindow: {
          id: workspace.registrationWindow.id,
          title: workspace.registrationWindow.title,
          status: "CLOSED",
        startAt: workspace.registrationWindow.studentRegistrationOpenAt,
        endAt: workspace.registrationWindow.registrationCloseAt,
        },
      })),
      lastUpdatedAt: lastUpdated ?? new Date().toISOString(),
      cardStatus: "Locked" as const,
      boardSummary: workspace.registrationWindow.examBoard.name,
    };
    return {
      ...buildConfirmationPrintData(group as never, {
        id: workspace.id,
        hasPostLockAdjustment: workspace.hasPostLockAdjustment,
        lastAdjustedAt: workspace.lastAdjustedAt,
        lastAdjustedByUser: workspace.lastAdjustedByUser,
        lastAdjustedByRole: workspace.lastAdjustedByRole,
        lastAdjustmentReason: workspace.lastAdjustmentReason,
        lastAdjustmentSummary: workspace.lastAdjustmentSummary,
        auditLogs: workspace.auditLogs,
      }),
      examBoardIdentities,
    };
  }, [workspace, lastUpdated]);

  async function executeApplyChanges() {
    setApplying(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${apiBase}/${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          addExamSessionIds: pendingAdd,
          removeRegistrationIds: pendingRemove,
          replacements: pendingReplace,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not apply changes");
      }
      setWorkspace(await response.json());
      setPendingAdd([]);
      setPendingRemove([]);
      setPendingReplace([]);
      setReason("");
      setAdjustMode(null);
      setConfirmFeeImpact(false);
      setFeeStatementRefreshKey((key) => key + 1);
      setFeeNeedsRegeneration(true);
      setSuccess(
        feeHasIssuedStatement
          ? "Changes applied. The issued fee statement is now superseded — regenerate and re-issue it in the Fee statements section below."
          : "Changes applied successfully. Review the fee statement section below if one already exists.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply changes");
    } finally {
      setApplying(false);
    }
  }

  async function applyChanges() {
    if (!reason.trim()) {
      setError("Adjustment reason is required.");
      return;
    }

    const hasPendingChanges =
      pendingAdd.length > 0 || pendingRemove.length > 0 || pendingReplace.length > 0;
    if (!hasPendingChanges) {
      setError("No changes to apply.");
      return;
    }

    if (feeHasIssuedStatement && !confirmFeeImpact) {
      setConfirmFeeImpact(true);
      return;
    }

    await executeApplyChanges();
  }

  function queueAdd() {
    if (!selectedSessionId) return;
    setPendingAdd((current) => (current.includes(selectedSessionId) ? current : [...current, selectedSessionId]));
    setSelectedSessionId("");
  }

  function queueRemove() {
    if (!selectedRegistrationId) return;
    setPendingRemove((current) => (current.includes(selectedRegistrationId) ? current : [...current, selectedRegistrationId]));
    setSelectedRegistrationId("");
  }

  function queueReplace() {
    if (!selectedRegistrationId || !replacementSessionId) return;
    setPendingReplace((current) => [
      ...current.filter((item) => item.registrationId !== selectedRegistrationId),
      { registrationId: selectedRegistrationId, newExamSessionId: replacementSessionId },
    ]);
    setSelectedRegistrationId("");
    setReplacementSessionId("");
  }

  async function reviewRequest(
    requestId: string,
    decision: "APPROVED" | "REJECTED",
    note?: string,
  ) {
    if (decision === "REJECTED" && !note?.trim()) {
      setRejectingRequestId(requestId);
      return;
    }

    setApplying(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/${workspaceId}/change-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewNote: note?.trim() || undefined }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not review request");
      }
      setWorkspace(await response.json());
      setRejectingRequestId(null);
      setRejectNote("");
      setFeeStatementRefreshKey((key) => key + 1);
      setFeeNeedsRegeneration(true);
      setSuccess(
        decision === "APPROVED"
          ? feeHasIssuedStatement
            ? "Change request approved and applied. The issued fee statement is now superseded — regenerate and re-issue it below."
            : "Change request approved and applied. Review the fee statement section if one already exists."
          : "Change request rejected.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review request");
    } finally {
      setApplying(false);
    }
  }

  function confirmReject() {
    if (!rejectingRequestId || !rejectNote.trim()) {
      setError("Review note is required when rejecting a change request.");
      return;
    }
    reviewRequest(rejectingRequestId, "REJECTED", rejectNote);
  }

  function targetExamLabel(
    req: WorkspaceData["changeRequests"][number],
  ): string {
    if (req.requestType === "LATE_REGISTRATION") {
      if (!req.examSessions?.length) return "—";
      return req.examSessions
        .map((item) => formatExamSessionSummary(item.examSession))
        .join("; ");
    }
    if (req.targetExamSession) {
      return formatExamSessionSummary(req.targetExamSession);
    }
    if (req.targetRegistrationId) {
      const registration = workspace?.registrations.find((row) => row.id === req.targetRegistrationId);
      if (registration) {
        return formatExamSessionSummary({
          date: registration.examSession.date,
          startTime: registration.examSession.startTime,
          paper: registration.examSession.paper,
        });
      }
    }
    return "—";
  }

  function requestedRoleLabel(role: string): string {
    if (role === "SUBJECT_TEACHER") return "Subject Teacher";
    if (role === "EXAM_OFFICER") return "Exam Officer";
    if (role === "ADMIN") return "Admin";
    return role;
  }

  if (loading) return <p className="text-sm text-slate-600">Loading...</p>;
  if (!workspace) return <p className="text-sm text-red-600">{error ?? "Not found"}</p>;

  const profile = workspace.student?.studentProfile;
  const candidate = workspace.candidate;
  const displayName =
    candidate?.englishName ?? workspace.student?.name ?? workspace.registrations[0]?.studentNameSnapshot ?? "—";
  const displayStudentNo =
    candidate?.studentNumber ?? profile?.studentNo ?? candidate?.assessmentHubCandidateNumber ?? "—";
  const adjustment = parseAdjustmentSummary(workspace.lastAdjustmentSummary);

  return (
    <div className="space-y-6">
      <p className="text-sm"><Link href={backHref} className="text-indigo-600 hover:text-indigo-700">← Back to registrations</Link></p>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}

      {feeNeedsRegeneration ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Fee statement needs to be regenerated</p>
          <p className="mt-1">
            Exam subjects no longer match the last fee statement. Scroll to{" "}
            <a href="#fee-statements-panel" className="font-medium text-amber-900 underline">
              Fee statements
            </a>{" "}
            and use <strong>Regenerate revised</strong>, then issue the new statement.
          </p>
        </div>
      ) : null}

      {confirmFeeImpact ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          <p className="font-medium">This will affect the issued fee statement</p>
          <p className="mt-2">
            This registration already has an issued fee statement. Changing exam subjects will mark it
            as superseded. You will need to regenerate and re-issue the fee statement afterwards.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={applying}
              onClick={() => void executeApplyChanges()}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
            >
              Continue with adjustment
            </button>
            <button
              type="button"
              disabled={applying}
              onClick={() => setConfirmFeeImpact(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{workspace.registrationWindow.title}</h1>
          <p className="text-sm text-slate-600">{displayName} · {displayStudentNo}</p>
        </div>
        {isLocked ? (
          <button type="button" onClick={() => setPrintOpen(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Print Confirmation
          </button>
        ) : null}
      </div>

      {printOpen && printData ? (
        <RegistrationConfirmationPrintModal data={printData} onClose={() => setPrintOpen(false)} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Candidate</h2>
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{displayName}</dd></div>
            <div><dt className="text-slate-500">Assessment Hub Candidate No.</dt><dd className="font-medium">{candidate?.assessmentHubCandidateNumber ?? workspace.registrations[0]?.assessmentHubCandidateNumberSnapshot ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Candidate Type</dt><dd className="font-medium">{candidate?.candidateType ?? workspace.registrations[0]?.candidateTypeSnapshot ?? "—"}</dd></div>
            {(candidate?.candidateType ?? workspace.registrations[0]?.candidateTypeSnapshot) === "INTERNAL" ? (
              <>
                <div><dt className="text-slate-500">Grade</dt><dd className="font-medium">{candidate?.grade ?? profile?.currentGrade ?? workspace.registrations[0]?.gradeSnapshot ?? "—"}</dd></div>
                <div><dt className="text-slate-500">Class</dt><dd className="font-medium">{candidate?.className ?? profile?.currentClassName ?? workspace.registrations[0]?.classNameSnapshot ?? "—"}</dd></div>
                <div><dt className="text-slate-500">Student No.</dt><dd className="font-medium">{candidate?.studentNumber ?? profile?.studentNo ?? workspace.registrations[0]?.studentNoSnapshot ?? "—"}</dd></div>
              </>
            ) : null}
            <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{candidate?.email ?? profile?.email ?? workspace.student?.email ?? workspace.registrations[0]?.emailSnapshot ?? "—"}</dd></div>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Registration Summary</h2>
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-slate-500">Exam Board</dt><dd className="font-medium">{workspace.registrationWindow.examBoard.name}</dd></div>
            <div><dt className="text-slate-500">Exam Series</dt><dd className="font-medium">{workspace.registrationWindow.examSeries.name} ({workspace.registrationWindow.examSeries.year})</dd></div>
            <div><dt className="text-slate-500">Registration Window</dt><dd className="font-medium">{formatWindowRange(workspace.registrationWindow.studentRegistrationOpenAt, workspace.registrationWindow.registrationCloseAt)}</dd></div>
            <div><dt className="text-slate-500">Status</dt><dd className="font-medium">{isLocked ? "Locked" : "Open"}</dd></div>
            <div><dt className="text-slate-500">Selected Exams</dt><dd className="font-medium">{workspace.registrations.length}</dd></div>
            <div><dt className="text-slate-500">Locked On</dt><dd className="font-medium">{lockedOn ? new Date(lockedOn).toLocaleString() : "—"}</dd></div>
            <div><dt className="text-slate-500">Last Updated</dt><dd className="font-medium">{lastUpdated ? new Date(lastUpdated).toLocaleString() : "—"}</dd></div>
            {workspace.hasPostLockAdjustment ? (
              <>
                <div><dt className="text-slate-500">Adjusted By</dt><dd className="font-medium">{formatAdjusterLabel(workspace.lastAdjustedByUser?.name, workspace.lastAdjustedByRole as never)}</dd></div>
                <div><dt className="text-slate-500">Adjusted On</dt><dd className="font-medium">{workspace.lastAdjustedAt ? new Date(workspace.lastAdjustedAt).toLocaleString() : "—"}</dd></div>
              </>
            ) : null}
          </dl>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Selected Exams</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead><tr className="bg-slate-50 text-slate-700">{["Subject", "Paper Code", "Paper Title", "Exam Date", "Exam Time", "Duration", "Session"].map((h) => <th key={h} className="border border-slate-200 px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {workspace.registrations.map((row) => (
                <tr key={row.id} className="even:bg-slate-50/50">
                  <td className="border border-slate-200 px-2 py-2">{row.subject.name}</td>
                  <td className="border border-slate-200 px-2 py-2">{row.examSession.paper.code}</td>
                  <td className="border border-slate-200 px-2 py-2">{row.examSession.paper.title}</td>
                  <td className="border border-slate-200 px-2 py-2">{formatExamDate(row.examSession.date)}</td>
                  <td className="border border-slate-200 px-2 py-2">{row.examSession.startTime ?? "—"}</td>
                  <td className="border border-slate-200 px-2 py-2">{formatDuration(row.examSession.paper.duration)}</td>
                  <td className="border border-slate-200 px-2 py-2">{formatExamSessionLabel(row.examSession)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {canAdjust && isLocked ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Adjustment Panel</h2>
          <div className="flex flex-wrap gap-2">
            {(["add", "remove", "replace"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => switchAdjustMode(mode)} className={`rounded-lg px-3 py-2 text-sm font-medium ${adjustMode === mode ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                {mode === "add" ? "Add Exam" : mode === "remove" ? "Remove Exam" : "Replace Exam"}
              </button>
            ))}
          </div>

          {adjustMode === "add" ? (
            <div className="mt-4 space-y-3">
              <ExamSessionSearchPicker
                sessions={sessions}
                loading={sessionsLoading}
                query={sessionQuery}
                onQueryChange={setSessionQuery}
                selectedId={selectedSessionId}
                onSelect={setSelectedSessionId}
                placeholder="Search by subject, paper code, or title..."
              />
              <button type="button" onClick={queueAdd} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">Add to preview</button>
            </div>
          ) : null}

          {adjustMode === "remove" ? (
            <div className="mt-4 space-y-3">
              <select value={selectedRegistrationId} onChange={(e) => setSelectedRegistrationId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Select exam to remove</option>
                {workspace.registrations.map((r) => (
                  <option key={r.id} value={r.id}>{r.subject.name} · {r.examSession.paper.code}</option>
                ))}
              </select>
              <button type="button" onClick={queueRemove} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">Add to preview</button>
            </div>
          ) : null}

          {adjustMode === "replace" ? (
            <div className="mt-4 space-y-3">
              <select value={selectedRegistrationId} onChange={(e) => setSelectedRegistrationId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Select exam to replace</option>
                {workspace.registrations.map((r) => (
                  <option key={r.id} value={r.id}>{r.subject.name} · {r.examSession.paper.code}</option>
                ))}
              </select>
              <ExamSessionSearchPicker
                sessions={sessions}
                loading={sessionsLoading}
                query={sessionQuery}
                onQueryChange={setSessionQuery}
                selectedId={replacementSessionId}
                onSelect={setReplacementSessionId}
                placeholder="Search replacement by subject, paper code, or title..."
              />
              <button type="button" onClick={queueReplace} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">Add to preview</button>
            </div>
          ) : null}

          {(pendingAdd.length > 0 || pendingRemove.length > 0 || pendingReplace.length > 0) ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-900">Preview changes</p>
              {pendingAdd.length > 0 ? <p className="mt-2">Add: {pendingAdd.length} session(s)</p> : null}
              {pendingRemove.length > 0 ? <p className="mt-1">Remove: {pendingRemove.length} registration(s)</p> : null}
              {pendingReplace.length > 0 ? <p className="mt-1">Replace: {pendingReplace.length} exam(s)</p> : null}
              <label className="mt-3 block">
                <span className="mb-1 block font-medium text-slate-700">Adjustment reason *</span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Required reason for this adjustment" />
              </label>
              <button type="button" disabled={applying} onClick={applyChanges} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {applying ? "Applying..." : "Apply Changes"}
              </button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Teacher Change Requests</h2>
        {workspace.changeRequests.length === 0 ? (
          <p className="text-sm text-slate-500">
            No teacher change requests for this registration yet. Teachers submit requests from{" "}
            <span className="font-medium">Class Registrations</span> after a registration is locked.
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {workspace.changeRequests.map((req) => (
              <li key={req.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Requested by</p>
                    <p className="font-medium text-slate-900">{req.requestedBy.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Requested role</p>
                    <p className="font-medium text-slate-900">{requestedRoleLabel(req.requestedByRole)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Request type</p>
                    <p className="font-medium text-slate-900">{changeRequestTypeLabel(req.requestType)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <p className="font-medium text-slate-900">{changeRequestStatusLabel(req.status)}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500">Target exam</p>
                    <p className="font-medium text-slate-900">{targetExamLabel(req)}</p>
                  </div>
                  {req.replacementExamSession ? (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-slate-500">Replacement exam</p>
                      <p className="font-medium text-slate-900">
                        {formatExamSessionSummary(req.replacementExamSession)}
                      </p>
                    </div>
                  ) : null}
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500">Reason</p>
                    <p className="text-slate-800">{req.reason}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Submitted at</p>
                    <p className="text-slate-800">{new Date(req.createdAt).toLocaleString()}</p>
                  </div>
                  {req.reviewedAt ? (
                    <div>
                      <p className="text-xs text-slate-500">Reviewed at</p>
                      <p className="text-slate-800">
                        {new Date(req.reviewedAt).toLocaleString()}
                        {req.reviewedBy ? ` · ${req.reviewedBy.name}` : ""}
                      </p>
                    </div>
                  ) : null}
                  {req.reviewNote ? (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-slate-500">Review note</p>
                      <p className="text-slate-800">{req.reviewNote}</p>
                    </div>
                  ) : null}
                </div>
                {canAdjust && req.status === "PENDING" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={applying}
                      onClick={() => reviewRequest(req.id, "APPROVED")}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={applying}
                      onClick={() => reviewRequest(req.id, "REJECTED")}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
                {rejectingRequestId === req.id ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-700">Review note *</span>
                      <textarea
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Reason for rejection"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={applying}
                        onClick={confirmReject}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm Reject
                      </button>
                      <button
                        type="button"
                        disabled={applying}
                        onClick={() => {
                          setRejectingRequestId(null);
                          setRejectNote("");
                        }}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {workspace ? (
        <FeeStatementPanel
          workspaceId={workspace.id}
          registrationWindowId={workspace.registrationWindow.id}
          locked={Boolean(workspace.lockedAt)}
          feeRulesHref={`${feeRulesHrefBase}/${workspace.registrationWindow.id}/fees`}
          refreshKey={feeStatementRefreshKey}
          onStatusChange={({ needsRegeneration, hasIssuedStatement }) => {
            setFeeNeedsRegeneration(needsRegeneration);
            setFeeHasIssuedStatement(hasIssuedStatement);
          }}
        />
      ) : null}

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Change History</h2>
        {workspace.auditLogs.length === 0 ? (
          <p className="text-sm text-slate-500">No audit history yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {workspace.auditLogs.map((log) => (
              <li key={log.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="font-medium text-slate-900">{auditActionLabel(log.action)}</p>
                <p className="text-slate-600">{log.performedBy.name} · {new Date(log.performedAt).toLocaleString()}</p>
                {log.reason ? <p className="mt-1 text-slate-700">Reason: {log.reason}</p> : null}
                {log.note ? <p className="text-slate-500">{log.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
