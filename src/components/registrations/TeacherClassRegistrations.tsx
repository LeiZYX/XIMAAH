"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { LateRegistrationModal } from "@/components/registrations/LateRegistrationModal";
import {
  TeacherChangeRequestModal,
  changeRequestStatusLabel,
  changeRequestTypeLabel,
  formatExamSessionSummary,
  type TeacherRegistrationRow,
} from "@/components/registrations/TeacherChangeRequestModal";

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

export function TeacherClassRegistrations() {
  const [rows, setRows] = useState<TeacherRegistrationRow[]>([]);
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
  const [filters, setFilters] = useState({
    examBoardId: "",
    examSeriesId: "",
    year: "",
    month: "",
    grade: "",
    className: "",
    subjectId: "",
    studentName: "",
    studentNo: "",
  });

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ status: "LOCKED" });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    try {
      const response = await fetch(`/api/teacher/registrations?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load registrations");
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setRows([]);
      setError(loadError instanceof Error ? loadError.message : "Could not load registrations");
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
    const params = new URLSearchParams();
    if (filters.examBoardId) params.set("examBoardId", filters.examBoardId);
    fetch(`/api/subjects?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => setSubjects([]));
  }, [filters.examBoardId]);

  useEffect(() => {
    void loadRegistrations();
    void loadRequests();
  }, []);

  function handleSubmitted() {
    setSuccess("Your change request has been submitted to the Exams Office for review.");
    loadRequests();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Class Registrations</h1>
          <p className="mt-1 text-sm text-slate-600">
            View locked registrations for your assigned subjects and submit change requests to the
            Exams Office.
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
                {subject.name}
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
          <button
            type="button"
            onClick={loadRegistrations}
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

      <Card className="overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Student Name</th>
                <th className="py-2 pr-4">Student No.</th>
                <th className="py-2 pr-4">Grade</th>
                <th className="py-2 pr-4">Class</th>
                <th className="py-2 pr-4">Exam Board</th>
                <th className="py-2 pr-4">Exam Series</th>
                <th className="py-2 pr-4">Subject</th>
                <th className="py-2 pr-4">Paper Code</th>
                <th className="py-2 pr-4">Paper Title</th>
                <th className="py-2 pr-4">Exam Date</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{row.studentNameSnapshot}</td>
                  <td className="py-2 pr-4">{row.studentNoSnapshot}</td>
                  <td className="py-2 pr-4">{row.gradeSnapshot}</td>
                  <td className="py-2 pr-4">{row.classNameSnapshot}</td>
                  <td className="py-2 pr-4">{row.examBoard.name}</td>
                  <td className="py-2 pr-4">
                    {row.examSeries.name} ({row.examSeries.year})
                  </td>
                  <td className="py-2 pr-4">{row.subject.name}</td>
                  <td className="py-2 pr-4">{row.paper.code}</td>
                  <td className="py-2 pr-4">{row.paper.title}</td>
                  <td className="py-2 pr-4">
                    {row.examSession.date.slice(0, 10)}
                    {row.examSession.startTime ? ` ${row.examSession.startTime}` : ""}
                  </td>
                  <td className="py-2 pr-4">Locked</td>
                  <td className="py-2 pr-4">
                    {row.registrationWorkspaceId ? (
                      <button
                        type="button"
                        onClick={() => setActiveRow(row)}
                        className="rounded-lg border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                      >
                        Request Change
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Unavailable</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && rows.length === 0 ? (
          <p className="text-sm text-slate-500">No locked registrations found.</p>
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

      {lateModalOpen ? (
        <LateRegistrationModal
          title="Request Late Registration"
          submitLabel="Submit to Exams Office"
          apiPath="/api/teacher/late-registration-requests"
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
