"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { LateRegistrationModal } from "@/components/registrations/LateRegistrationModal";
import { TeacherStudentRegistrationRequestModal } from "@/components/registrations/TeacherStudentRegistrationRequestModal";
import {
  TeacherChangeRequestModal,
  changeRequestStatusLabel,
  changeRequestTypeLabel,
  formatExamSessionSummary,
  type TeacherRegistrationRow,
} from "@/components/registrations/TeacherChangeRequestModal";
import {
  RegistrationConfirmationPrintModal,
  RegistrationPrintButton,
  buildConfirmationPrintData,
} from "@/components/registrations/RegistrationConfirmationPrintModal";
import type {
  TeacherStudentDetail,
  TeacherStudentSummary,
} from "@/lib/registrations/teacher-student-list";
import { TEACHER_STUDENT_PAGE_SIZES } from "@/lib/pagination";

interface ExamBoardOption {
  id: string;
  name: string;
  code: string;
}

interface ExamSeriesOption {
  id: string;
  name: string;
  year: number;
}

interface SubjectOption {
  id: string;
  name: string;
  code: string;
  qualification: {
    name: string;
    level: string;
    examBoardCode?: string;
  };
}

interface ChangeRequestRow {
  id: string;
  requestType: string;
  status: string;
  reason: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  requestedBy: { name: string; role: string };
  targetExamSession: {
    date: string;
    startTime: string | null;
    paper: { code: string; title: string };
  } | null;
  replacementExamSession: {
    date: string;
    startTime: string | null;
    paper: { code: string; title: string };
  } | null;
  registrationWorkspace: {
    student: { name: string; studentProfile: { studentNo: string } | null };
    registrationWindow: {
      examBoard: { name: string };
      examSeries: { name: string; year: number };
    };
  };
}

interface StudentListResponse {
  students: TeacherStudentSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const defaultFilters = {
  examBoardId: "",
  examSeriesId: "",
  year: "",
  month: "",
  grade: "",
  className: "",
  subjectId: "",
  studentName: "",
  studentNo: "",
  assessmentHubCandidateNumber: "",
};

function formatSubjectLabel(subject: SubjectOption): string {
  const board = subject.qualification.examBoardCode
    ? `${subject.qualification.examBoardCode} · `
    : "";
  return `${board}${subject.name} · ${subject.qualification.level} · ${subject.code}`;
}

function registrationStatusLabel(status: TeacherStudentSummary["registrationStatus"]): string {
  switch (status) {
    case "LOCKED":
      return "Locked";
    case "ACTIVE":
      return "Active";
    case "MIXED":
      return "Mixed";
    default:
      return status;
  }
}

function registrationStatusClass(status: TeacherStudentSummary["registrationStatus"]): string {
  switch (status) {
    case "LOCKED":
      return "font-medium text-indigo-700";
    case "ACTIVE":
      return "text-amber-700";
    case "MIXED":
      return "text-violet-700";
    default:
      return "text-slate-700";
  }
}

function buildFilterParams(filters: typeof defaultFilters): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params;
}

function TeacherStudentDetailPanel({
  detail,
  loading,
  error,
  onRequestChange,
}: {
  detail: TeacherStudentDetail | null;
  loading: boolean;
  error: string | null;
  onRequestChange: (row: TeacherRegistrationRow) => void;
}) {
  if (loading) {
    return <p className="border-t border-slate-100 px-4 py-4 text-sm text-slate-500">Loading registration detail…</p>;
  }

  if (error || !detail) {
    return (
      <p className="border-t border-slate-100 px-4 py-4 text-sm text-red-700">
        {error ?? "Could not load registration detail."}
      </p>
    );
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Student summary</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">{detail.summary.studentName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Student number</dt>
              <dd className="font-medium text-slate-900">{detail.summary.studentNo}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Grade / Class</dt>
              <dd className="font-medium text-slate-900">
                {detail.summary.grade} · {detail.summary.className}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Candidate information</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Candidate number</dt>
              <dd className="font-medium text-slate-900">{detail.candidate.candidateNumber}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Candidate type</dt>
              <dd className="font-medium text-slate-900">{detail.candidate.candidateType}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-900">{detail.candidate.email ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Registration summary</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Total exams</dt>
              <dd className="font-medium text-slate-900">{detail.registrationSummary.totalExams}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Active / Locked</dt>
              <dd className="font-medium text-slate-900">
                {detail.registrationSummary.activeExams} active · {detail.registrationSummary.lockedExams} locked
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Registration windows</dt>
              <dd className="font-medium text-slate-900">
                {detail.registrationSummary.windows.length === 0
                  ? "—"
                  : detail.registrationSummary.windows
                      .map((window) => `${window.title} (${window.examCount})`)
                      .join("; ")}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Paper code</th>
              <th className="px-3 py-2">Paper title</th>
              <th className="px-3 py-2">Exam date</th>
              <th className="px-3 py-2">Entry type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {detail.exams.map((exam) => (
              <tr key={exam.id} className="border-b border-slate-100">
                <td className="px-3 py-2">{exam.subject.name}</td>
                <td className="px-3 py-2">{exam.paper.code}</td>
                <td className="px-3 py-2">{exam.paper.title}</td>
                <td className="px-3 py-2">
                  {exam.examSession.date.slice(0, 10)}
                  {exam.examSession.startTime ? ` ${exam.examSession.startTime}` : ""}
                </td>
                <td className="px-3 py-2">{exam.entryTypeLabel}</td>
                <td className="px-3 py-2">
                  <span className={exam.status === "LOCKED" ? "font-medium text-indigo-700" : "text-amber-700"}>
                    {exam.status === "LOCKED" ? "Locked" : "Active"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {exam.registrationWorkspaceId && exam.status === "LOCKED" ? (
                    <button
                      type="button"
                      onClick={() => onRequestChange(exam)}
                      className="rounded-lg border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                    >
                      Request Change
                    </button>
                  ) : exam.status === "ACTIVE" ? (
                    <span className="text-xs text-slate-400">Awaiting window close</span>
                  ) : (
                    <span className="text-xs text-slate-400">Unavailable</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TeacherClassRegistrations() {
  const [students, setStudents] = useState<TeacherStudentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [requests, setRequests] = useState<ChangeRequestRow[]>([]);
  const [examBoards, setExamBoards] = useState<ExamBoardOption[]>([]);
  const [examSeries, setExamSeries] = useState<ExamSeriesOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeRow, setActiveRow] = useState<TeacherRegistrationRow | null>(null);
  const [lateModalOpen, setLateModalOpen] = useState(false);
  const [studentRequestTarget, setStudentRequestTarget] = useState<TeacherStudentSummary | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [expandedStudentKey, setExpandedStudentKey] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, TeacherStudentDetail>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [detailLoadingKey, setDetailLoadingKey] = useState<string | null>(null);
  const [printData, setPrintData] = useState<ReturnType<typeof buildConfirmationPrintData> | null>(null);

  const filterParams = useMemo(() => buildFilterParams(appliedFilters), [appliedFilters]);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams(filterParams);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    try {
      const response = await fetch(`/api/teacher/registrations/students?${params.toString()}`);
      const data = (await response.json()) as StudentListResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not load student registrations");
      }
      setStudents(Array.isArray(data.students) ? data.students : []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
    } catch (loadError) {
      setStudents([]);
      setTotal(0);
      setTotalPages(0);
      setError(loadError instanceof Error ? loadError.message : "Could not load student registrations");
    } finally {
      setLoading(false);
    }
  }, [filterParams, page, pageSize]);

  const loadStudentDetail = useCallback(
    async (studentKey: string) => {
      setDetailLoadingKey(studentKey);
      setDetailErrors((current) => {
        const next = { ...current };
        delete next[studentKey];
        return next;
      });
      try {
        const params = new URLSearchParams(filterParams);
        params.set("studentKey", studentKey);
        const response = await fetch(`/api/teacher/registrations/students?${params.toString()}`);
        const data = (await response.json()) as TeacherStudentDetail & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || "Could not load student detail");
        }
        setDetailCache((current) => ({ ...current, [studentKey]: data }));
      } catch (loadError) {
        setDetailErrors((current) => ({
          ...current,
          [studentKey]:
            loadError instanceof Error ? loadError.message : "Could not load student detail",
        }));
        setDetailCache((current) => {
          const next = { ...current };
          delete next[studentKey];
          return next;
        });
      } finally {
        setDetailLoadingKey(null);
      }
    },
    [filterParams],
  );

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const response = await fetch("/api/teacher/change-requests");
      const data = await response.json();
      setRequests(response.ok && Array.isArray(data) ? data : []);
    } catch {
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/exam-boards")
      .then((r) => r.json())
      .then((data) => setExamBoards(Array.isArray(data) ? data : []))
      .catch(() => setExamBoards([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.examBoardId) params.set("examBoardId", filters.examBoardId);
    fetch(`/api/exam-series?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setExamSeries(Array.isArray(data) ? data : []))
      .catch(() => setExamSeries([]));
  }, [filters.examBoardId]);

  useEffect(() => {
    fetch("/api/teacher/subjects")
      .then((r) => r.json())
      .then((data: SubjectOption[]) => {
        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => formatSubjectLabel(a).localeCompare(formatSubjectLabel(b)));
        setSubjects(list);
      })
      .catch(() => setSubjects([]));
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    setDetailCache({});
    setDetailErrors({});
    setExpandedStudentKey(null);
  }, [appliedFilters]);

  function applyFilters() {
    setAppliedFilters(filters);
    setPage(1);
    setExpandedStudentKey(null);
    setDetailCache({});
    setDetailErrors({});
  }

  function toggleExpand(studentKey: string) {
    if (expandedStudentKey === studentKey) {
      setExpandedStudentKey(null);
      return;
    }
    setExpandedStudentKey(studentKey);
    if (!detailCache[studentKey]) {
      void loadStudentDetail(studentKey);
    }
  }

  async function handlePrint(student: TeacherStudentSummary) {
    const detail = detailCache[student.studentKey] ?? (await (async () => {
      const params = new URLSearchParams(filterParams);
      params.set("studentKey", student.studentKey);
      const response = await fetch(`/api/teacher/registrations/students?${params.toString()}`);
      if (!response.ok) return null;
      const data = (await response.json()) as TeacherStudentDetail;
      setDetailCache((current) => ({ ...current, [student.studentKey]: data }));
      return data;
    })());

    if (!detail) return;

    const lockedGroup = detail.windowGroups.find((group) => group.cardStatus === "Locked");
    if (!lockedGroup) return;

    setPrintData(
      buildConfirmationPrintData(lockedGroup, {
        id: lockedGroup.workspaceId,
        hasPostLockAdjustment: lockedGroup.hasPostLockAdjustment,
        lastAdjustedAt: lockedGroup.lastAdjustedAt,
        lastAdjustedByUser: lockedGroup.lastAdjustedByName ? { name: lockedGroup.lastAdjustedByName } : null,
        lastAdjustedByRole: lockedGroup.lastAdjustedByRole,
        lastAdjustmentReason: lockedGroup.lastAdjustmentReason,
        lastAdjustmentSummary: lockedGroup.lastAdjustmentSummary,
      }),
    );
  }

  async function openStudentRequestModal(student: TeacherStudentSummary) {
    if (detailCache[student.studentKey]) {
      setStudentRequestTarget(student);
      return;
    }

    setDetailLoadingKey(student.studentKey);
    try {
      const params = new URLSearchParams(filterParams);
      params.set("studentKey", student.studentKey);
      const response = await fetch(`/api/teacher/registrations/students?${params.toString()}`);
      const data = (await response.json()) as TeacherStudentDetail & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not load student detail");
      }
      setDetailCache((current) => ({ ...current, [student.studentKey]: data }));
      setStudentRequestTarget(student);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load student detail",
      );
    } finally {
      setDetailLoadingKey(null);
    }
  }

  function handleSubmitted() {
    setSuccess("Your change request has been submitted to the Exams Office for review.");
    setDetailCache({});
    void loadStudents();
    void loadRequests();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Class Registrations</h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse registrations by student. Expand a student to view their exam list and submit change
            requests for locked entries.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLateModalOpen(true)}
          className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
        >
          Request Late Registration
        </button>
      </div>

      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={filters.examBoardId}
            onChange={(e) =>
              setFilters({ ...filters, examBoardId: e.target.value, examSeriesId: "", subjectId: "" })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All exam boards</option>
            {examBoards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
          <select
            value={filters.examSeriesId}
            onChange={(e) => setFilters({ ...filters, examSeriesId: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All exam series</option>
            {examSeries.map((series) => (
              <option key={series.id} value={series.id}>
                {series.name} ({series.year})
              </option>
            ))}
          </select>
          <input
            placeholder="Year"
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Month"
            value={filters.month}
            onChange={(e) => setFilters({ ...filters, month: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Grade"
            value={filters.grade}
            onChange={(e) => setFilters({ ...filters, grade: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Class"
            value={filters.className}
            onChange={(e) => setFilters({ ...filters, className: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={filters.subjectId}
            onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {formatSubjectLabel(subject)}
              </option>
            ))}
          </select>
          <input
            placeholder="Student name"
            value={filters.studentName}
            onChange={(e) => setFilters({ ...filters, studentName: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Student number"
            value={filters.studentNo}
            onChange={(e) => setFilters({ ...filters, studentNo: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Candidate number"
            value={filters.assessmentHubCandidateNumber}
            onChange={(e) =>
              setFilters({ ...filters, assessmentHubCandidateNumber: e.target.value })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Filter
          </button>
        </div>
      </Card>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <p className="text-sm text-slate-600">
            {loading ? "Loading students…" : `${total} student${total === 1 ? "" : "s"} found`}
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Per page
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
            >
              {TEACHER_STUDENT_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading...</p>
        ) : students.length === 0 ? (
          <div className="space-y-2 px-4 py-6 text-sm text-slate-500">
            <p>No registrations found.</p>
            <p className="text-xs text-slate-400">
              Students appear here after registering. Expand a student row to view their exams.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="hidden lg:table-header-group">
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 font-medium">Student</th>
                    <th className="px-4 py-2 font-medium">Grade / Class</th>
                    <th className="px-4 py-2 font-medium">Exam board(s)</th>
                    <th className="px-4 py-2 font-medium">Exam series</th>
                    <th className="px-4 py-2 font-medium">Total exams</th>
                    <th className="px-4 py-2 font-medium">Pending requests</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((student) => {
                    const expanded = expandedStudentKey === student.studentKey;
                    return (
                      <Fragment key={student.studentKey}>
                        <tr className="align-top lg:align-middle">
                          <td className="px-4 py-4 lg:whitespace-nowrap">
                            <p className="font-medium text-slate-900">{student.studentName}</p>
                            <p className="text-xs text-slate-500">
                              {student.studentNo} · {student.candidateNumber}
                            </p>
                          </td>
                          <td className="hidden px-4 py-4 text-slate-700 lg:table-cell">
                            {student.grade} · {student.className}
                          </td>
                          <td className="hidden px-4 py-4 text-slate-700 lg:table-cell">
                            {student.examBoards}
                          </td>
                          <td className="hidden px-4 py-4 text-slate-700 lg:table-cell">
                            {student.examSeries}
                          </td>
                          <td className="hidden px-4 py-4 font-medium text-slate-900 lg:table-cell">
                            {student.totalExams}
                          </td>
                          <td className="hidden px-4 py-4 text-slate-700 lg:table-cell">
                            {student.pendingChangeRequests > 0 ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                {student.pendingChangeRequests} pending
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="hidden px-4 py-4 lg:table-cell">
                            <span className={registrationStatusClass(student.registrationStatus)}>
                              {registrationStatusLabel(student.registrationStatus)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                              <button
                                type="button"
                                onClick={() => toggleExpand(student.studentKey)}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                {expanded ? "Collapse" : "Expand"}
                              </button>
                              {student.canPrint ? (
                                <RegistrationPrintButton
                                  onClick={() => void handlePrint(student)}
                                  className="rounded-lg px-2 py-1.5 text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-50"
                                />
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void openStudentRequestModal(student)}
                                className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                              >
                                Request Late Registration
                              </button>
                            </div>
                            <dl className="mt-3 space-y-1 text-sm text-slate-700 lg:hidden">
                              <div>
                                <dt className="text-xs uppercase text-slate-500">Grade / Class</dt>
                                <dd>
                                  {student.grade} · {student.className}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs uppercase text-slate-500">Exam board(s)</dt>
                                <dd>{student.examBoards}</dd>
                              </div>
                              <div>
                                <dt className="text-xs uppercase text-slate-500">Exam series</dt>
                                <dd>{student.examSeries}</dd>
                              </div>
                              <div>
                                <dt className="text-xs uppercase text-slate-500">Total exams</dt>
                                <dd>{student.totalExams}</dd>
                              </div>
                              <div>
                                <dt className="text-xs uppercase text-slate-500">Pending requests</dt>
                                <dd>
                                  {student.pendingChangeRequests > 0
                                    ? `${student.pendingChangeRequests} pending`
                                    : "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs uppercase text-slate-500">Status</dt>
                                <dd className={registrationStatusClass(student.registrationStatus)}>
                                  {registrationStatusLabel(student.registrationStatus)}
                                </dd>
                              </div>
                            </dl>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr>
                            <td colSpan={8} className="border-t border-slate-100 bg-slate-50/50 px-4 py-4">
                              <TeacherStudentDetailPanel
                                detail={detailCache[student.studentKey] ?? null}
                                loading={detailLoadingKey === student.studentKey}
                                error={detailErrors[student.studentKey] ?? null}
                                onRequestChange={setActiveRow}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">My Change Requests</h2>
        {requestsLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-500">You have not submitted any change requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Board / Series</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Target Exam</th>
                  <th className="py-2 pr-4">Replacement</th>
                  <th className="py-2 pr-4">Reason</th>
                  <th className="py-2 pr-4">Submitted</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">
                      {request.registrationWorkspace.student.name}
                      <span className="block text-xs text-slate-500">
                        {request.registrationWorkspace.student.studentProfile?.studentNo ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {request.registrationWorkspace.registrationWindow.examBoard.name}
                      <span className="block text-xs text-slate-500">
                        {request.registrationWorkspace.registrationWindow.examSeries.name} (
                        {request.registrationWorkspace.registrationWindow.examSeries.year})
                      </span>
                    </td>
                    <td className="py-2 pr-4">{changeRequestTypeLabel(request.requestType)}</td>
                    <td className="py-2 pr-4">{formatExamSessionSummary(request.targetExamSession)}</td>
                    <td className="py-2 pr-4">
                      {formatExamSessionSummary(request.replacementExamSession)}
                    </td>
                    <td className="py-2 pr-4 max-w-xs truncate" title={request.reason}>
                      {request.reason}
                    </td>
                    <td className="py-2 pr-4">{new Date(request.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          request.status === "PENDING"
                            ? "bg-amber-100 text-amber-800"
                            : request.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {changeRequestStatusLabel(request.status)}
                      </span>
                      {request.status === "REJECTED" && request.reviewNote ? (
                        <span className="mt-1 block text-xs text-slate-500">{request.reviewNote}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {activeRow ? (
        <TeacherChangeRequestModal
          row={activeRow}
          onClose={() => setActiveRow(null)}
          onSubmitted={handleSubmitted}
        />
      ) : null}

      {printData ? (
        <RegistrationConfirmationPrintModal data={printData} onClose={() => setPrintData(null)} />
      ) : null}

      {studentRequestTarget && detailCache[studentRequestTarget.studentKey] ? (
        <TeacherStudentRegistrationRequestModal
          summary={studentRequestTarget}
          detail={detailCache[studentRequestTarget.studentKey]}
          onClose={() => setStudentRequestTarget(null)}
          onSubmitted={(count) => {
            setSuccess(
              `${count} change request${count === 1 ? "" : "s"} submitted to the Exams Office for review.`,
            );
            setDetailCache({});
            void loadStudents();
            void loadRequests();
          }}
        />
      ) : null}

      {lateModalOpen ? (
        <LateRegistrationModal
          title="Request Late Registration"
          submitLabel="Submit to Exams Office"
          apiPath="/api/teacher/late-registration-requests"
          windowFilter="teacher"
          onClose={() => setLateModalOpen(false)}
          onSubmitted={() => {
            setSuccess("Your late registration request has been submitted to the Exams Office for review.");
            loadRequests();
          }}
        />
      ) : null}
    </div>
  );
}
