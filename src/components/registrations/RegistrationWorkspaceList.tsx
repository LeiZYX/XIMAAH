"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { ListPagination } from "@/components/ui/ListPagination";
import {
  buildWorkspaceConfirmationPrintData,
  RegistrationConfirmationPrintModal,
  type ConfirmationPrintData,
} from "@/components/registrations/RegistrationConfirmationPrintModal";
import { useRegistrationsRefresh } from "@/components/registrations/registrations-refresh";
import { readJsonResponse } from "@/lib/client/fetch-json";
import { LIST_PAGE_SIZES } from "@/lib/pagination";
import {
  registrationTypeBadgeClass,
  registrationTypeBadgeLabel,
  resolveWorkspaceTableView,
  serializeStaffRegistrationTypes,
  workspaceListDescription,
  workspaceListTitle,
  type WorkspaceTableView,
} from "@/lib/registrations/workspace-type-filters";
import {
  formatAdjusterLabel,
  workspaceStudentLabel,
  workspaceStudentNo,
} from "@/lib/registrations/workspace-display";

interface WorkspaceRegistration {
  id: string;
  status: string;
  examSessionId: string;
  gradeSnapshot: string | null;
  classNameSnapshot: string | null;
  studentNameSnapshot: string | null;
  studentNoSnapshot: string | null;
}

interface WorkspaceRow {
  id: string;
  lockedAt: string | null;
  hasPostLockAdjustment: boolean;
  lastAdjustedAt: string | null;
  registrationType: string;
  restrictedReason: string | null;
  restrictedCreatedAt: string | null;
  student: {
    name: string;
    studentNo: string | null;
    email: string | null;
    studentProfile: { currentGrade: string | null; currentClassName: string | null } | null;
  } | null;
  candidate: {
    englishName: string | null;
    studentNumber: string | null;
    candidateType: string | null;
    email: string | null;
    phone: string | null;
    grade: string | null;
    className: string | null;
    assessmentHubCandidateNumber: string | null;
  } | null;
  registrationWindow: {
    title: string;
    examBoard: { name: string };
    examSeries: { name: string; year: number };
  };
  registrations: WorkspaceRegistration[];
  lastAdjustedByUser: { name: string } | null;
  lastAdjustedByRole: string | null;
  changeRequests: Array<{ id: string; status: string }>;
  restrictedCreatedBy: { name: string } | null;
}

interface PaginatedWorkspaces {
  workspaces: WorkspaceRow[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

function staffBasePathFromDetail(detailBasePath: string): "/admin" | "/exam-office" {
  return detailBasePath.startsWith("/exam-office") ? "/exam-office" : "/admin";
}

function workspaceStatus(row: WorkspaceRow): string {
  if (row.lockedAt) return "Locked";
  if (row.registrations.length > 0 && row.registrations.every((reg) => reg.status === "LOCKED")) {
    return "Locked";
  }
  return "Active";
}

function sessionCount(row: WorkspaceRow): number {
  return new Set(row.registrations.map((reg) => reg.examSessionId)).size;
}

function gradeLabel(row: WorkspaceRow): string {
  const reg = row.registrations[0];
  return (
    reg?.gradeSnapshot ||
    row.student?.studentProfile?.currentGrade ||
    row.candidate?.grade ||
    "—"
  );
}

function classLabel(row: WorkspaceRow): string {
  const reg = row.registrations[0];
  return (
    reg?.classNameSnapshot ||
    row.student?.studentProfile?.currentClassName ||
    row.candidate?.className ||
    "—"
  );
}

function contactLabel(row: WorkspaceRow): string {
  return (
    row.candidate?.email ||
    row.candidate?.phone ||
    row.student?.email ||
    "—"
  );
}

function pendingCount(row: WorkspaceRow): number {
  return row.changeRequests.filter((request) => request.status === "PENDING").length;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${registrationTypeBadgeClass(type)}`}
    >
      {registrationTypeBadgeLabel(type)}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
}) {
  const className =
    "rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

export function RegistrationWorkspaceList({
  apiPath,
  detailBasePath,
}: {
  apiPath: string;
  detailBasePath: string;
}) {
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [printModal, setPrintModal] = useState<{
    data: ConfirmationPrintData;
    autoPrint: boolean;
  } | null>(null);
  const { workspaceRefreshKey, registrationWindowId, registrationTypes } = useRegistrationsRefresh();

  const staffBasePath = staffBasePathFromDetail(detailBasePath);
  const examDocumentsApi =
    staffBasePath === "/admin" ? "/api/admin/exam-documents" : "/api/exam-office/exam-documents";
  const workspaceApiBase = `/api${detailBasePath}`;
  const tableView = resolveWorkspaceTableView(registrationTypes);
  const title = workspaceListTitle(registrationTypes);
  const description = workspaceListDescription(registrationTypes);

  useEffect(() => {
    setPage(1);
  }, [registrationWindowId, registrationTypes]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lockedOnly: "true",
        page: String(page),
        pageSize: String(pageSize),
        registrationTypes: serializeStaffRegistrationTypes(registrationTypes),
      });
      if (registrationWindowId) {
        params.set("registrationWindowId", registrationWindowId);
      }
      const response = await fetch(`${apiPath}?${params.toString()}`);
      const data = await readJsonResponse<PaginatedWorkspaces>(response);
      if (response.ok && data.workspaces) {
        setRows(data.workspaces);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        setRows([]);
        setTotal(0);
        setTotalPages(0);
      }
    } catch {
      setRows([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [apiPath, registrationWindowId, registrationTypes, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load, workspaceRefreshKey]);

  async function openPrintModal(workspaceId: string, autoPrint: boolean) {
    setActionRowId(workspaceId);
    setActionError(null);
    try {
      const response = await fetch(`${workspaceApiBase}/${workspaceId}`);
      const workspace = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(
          typeof workspace === "object" && workspace && "error" in workspace
            ? String((workspace as { error: string }).error)
            : "Failed to load registration",
        );
      }
      setPrintModal({
        data: buildWorkspaceConfirmationPrintData(workspace as never),
        autoPrint,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to load registration");
    } finally {
      setActionRowId(null);
    }
  }

  async function generateRestrictedInvoice(workspaceId: string, issue: boolean) {
    setActionRowId(workspaceId);
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await fetch(`${examDocumentsApi}?action=${issue ? "print" : "preview"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: "RESTRICTED_INVOICE",
          workspaceId,
        }),
      });
      const data = await readJsonResponse<{ error?: string; invoice?: { statementNo?: string } }>(
        response,
      );
      if (!response.ok) throw new Error(data.error ?? "Restricted invoice failed");
      setActionMessage(
        issue
          ? `Restricted invoice ${data.invoice?.statementNo ?? ""} generated.`
          : `Restricted invoice ${data.invoice?.statementNo ?? ""} preview ready.`,
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Restricted invoice failed");
    } finally {
      setActionRowId(null);
    }
  }

  const auditLogHref = registrationWindowId
    ? `${staffBasePath}/registration-windows/${registrationWindowId}/audit-log`
    : null;

  const emptyMessage = useMemo(() => {
    if (!registrationWindowId) {
      return "Select a registration window to view registrations.";
    }
    if (tableView === "normal") {
      return "No internal student registrations for this window yet.";
    }
    if (tableView === "restricted") {
      return "No restricted registrations for this window yet.";
    }
    if (tableView === "external") {
      return "No external candidate registrations for this window yet.";
    }
    return "No registrations match the selected type filters.";
  }, [registrationWindowId, tableView]);

  function renderActions(row: WorkspaceRow, view: WorkspaceTableView) {
    const busy = actionRowId === row.id;
    const detailHref = `${detailBasePath}/${row.id}`;

    if (view === "normal") {
      return (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionButton disabled={busy} onClick={() => void openPrintModal(row.id, false)}>
            {busy ? "Loading…" : "Preview"}
          </ActionButton>
          <ActionButton disabled={busy} onClick={() => void openPrintModal(row.id, true)}>
            Print
          </ActionButton>
          <ActionButton href={detailHref}>Open detail</ActionButton>
          <ActionButton href={`${detailHref}#fee-statement`}>Fee statement</ActionButton>
        </div>
      );
    }

    if (view === "restricted") {
      return (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionButton href={detailHref}>Open detail</ActionButton>
          <ActionButton
            disabled={busy}
            onClick={() => void generateRestrictedInvoice(row.id, false)}
          >
            Restricted invoice
          </ActionButton>
          {auditLogHref ? <ActionButton href={auditLogHref}>Audit log</ActionButton> : null}
        </div>
      );
    }

    if (view === "external") {
      const docsHref = `${staffBasePath}/exam-documents?registrationWindowId=${registrationWindowId}&registrationType=EXTERNAL`;
      return (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionButton href={detailHref}>Open detail</ActionButton>
          <ActionButton href={docsHref}>Print documents</ActionButton>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ActionButton href={detailHref}>Open detail</ActionButton>
        {row.registrationType === "NORMAL" ? (
          <>
            <ActionButton disabled={busy} onClick={() => void openPrintModal(row.id, false)}>
              Preview
            </ActionButton>
            <ActionButton href={`${detailHref}#fee-statement`}>Fee statement</ActionButton>
          </>
        ) : null}
        {row.registrationType === "RESTRICTED" ? (
          <ActionButton
            disabled={busy}
            onClick={() => void generateRestrictedInvoice(row.id, false)}
          >
            Restricted invoice
          </ActionButton>
        ) : null}
        {row.registrationType === "EXTERNAL" ? (
          <ActionButton
            href={`${staffBasePath}/exam-documents?registrationWindowId=${registrationWindowId}&registrationType=EXTERNAL`}
          >
            Documents
          </ActionButton>
        ) : null}
      </div>
    );
  }

  function renderTable(view: WorkspaceTableView) {
    if (view === "normal") {
      return (
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600">
              <th className="py-2 pr-4 font-medium">Student</th>
              <th className="py-2 pr-4 font-medium">Student No.</th>
              <th className="py-2 pr-4 font-medium">Grade</th>
              <th className="py-2 pr-4 font-medium">Class</th>
              <th className="py-2 pr-4 font-medium">Exam Board</th>
              <th className="py-2 pr-4 font-medium">Sessions</th>
              <th className="py-2 pr-4 font-medium">Exams</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Pending requests</th>
              <th className="py-2 pr-4 font-medium">Adjusted by</th>
              <th className="py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-900">
                  {workspaceStudentLabel(row)}
                </td>
                <td className="py-2 pr-4">{workspaceStudentNo(row) ?? "—"}</td>
                <td className="py-2 pr-4">{gradeLabel(row)}</td>
                <td className="py-2 pr-4">{classLabel(row)}</td>
                <td className="py-2 pr-4">{row.registrationWindow.examBoard.name}</td>
                <td className="py-2 pr-4">{sessionCount(row)}</td>
                <td className="py-2 pr-4">{row.registrations.length}</td>
                <td className="py-2 pr-4">{workspaceStatus(row)}</td>
                <td className="py-2 pr-4">
                  {pendingCount(row) > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {pendingCount(row)} pending
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-4">
                  {row.hasPostLockAdjustment
                    ? formatAdjusterLabel(
                        row.lastAdjustedByUser?.name,
                        row.lastAdjustedByRole as never,
                      )
                    : "—"}
                </td>
                <td className="py-2">{renderActions(row, "normal")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (view === "restricted") {
      return (
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600">
              <th className="py-2 pr-4 font-medium">Student</th>
              <th className="py-2 pr-4 font-medium">Student No.</th>
              <th className="py-2 pr-4 font-medium">Registration</th>
              <th className="py-2 pr-4 font-medium">Restricted reason</th>
              <th className="py-2 pr-4 font-medium">Exams</th>
              <th className="py-2 pr-4 font-medium">Created by</th>
              <th className="py-2 pr-4 font-medium">Created at</th>
              <th className="py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-900">
                  <div className="flex flex-col gap-1">
                    <span>{workspaceStudentLabel(row)}</span>
                    <TypeBadge type="RESTRICTED" />
                  </div>
                </td>
                <td className="py-2 pr-4">{workspaceStudentNo(row) ?? "—"}</td>
                <td className="py-2 pr-4">
                  {row.registrationWindow.title}
                  <span className="block text-xs text-slate-500">
                    {row.registrationWindow.examBoard.name}
                  </span>
                </td>
                <td className="max-w-xs py-2 pr-4 text-slate-700">
                  {row.restrictedReason?.trim() || "—"}
                </td>
                <td className="py-2 pr-4">{row.registrations.length}</td>
                <td className="py-2 pr-4">{row.restrictedCreatedBy?.name ?? "—"}</td>
                <td className="py-2 pr-4">
                  {row.restrictedCreatedAt
                    ? new Date(row.restrictedCreatedAt).toLocaleString()
                    : "—"}
                </td>
                <td className="py-2">{renderActions(row, "restricted")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (view === "external") {
      return (
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600">
              <th className="py-2 pr-4 font-medium">Candidate</th>
              <th className="py-2 pr-4 font-medium">Candidate No.</th>
              <th className="py-2 pr-4 font-medium">Contact</th>
              <th className="py-2 pr-4 font-medium">Exam Board</th>
              <th className="py-2 pr-4 font-medium">Sessions</th>
              <th className="py-2 pr-4 font-medium">Exams</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-900">
                  <div className="flex flex-col gap-1">
                    <span>{workspaceStudentLabel(row)}</span>
                    <TypeBadge type="EXTERNAL" />
                  </div>
                </td>
                <td className="py-2 pr-4">
                  {row.candidate?.assessmentHubCandidateNumber ||
                    workspaceStudentNo(row) ||
                    "—"}
                </td>
                <td className="py-2 pr-4">{contactLabel(row)}</td>
                <td className="py-2 pr-4">{row.registrationWindow.examBoard.name}</td>
                <td className="py-2 pr-4">{sessionCount(row)}</td>
                <td className="py-2 pr-4">{row.registrations.length}</td>
                <td className="py-2 pr-4">{workspaceStatus(row)}</td>
                <td className="py-2">{renderActions(row, "external")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-600">
            <th className="py-2 pr-4 font-medium">Type</th>
            <th className="py-2 pr-4 font-medium">Candidate/Student</th>
            <th className="py-2 pr-4 font-medium">Registration</th>
            <th className="py-2 pr-4 font-medium">Exams</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="py-2 pr-4">
                <TypeBadge type={row.registrationType} />
              </td>
              <td className="py-2 pr-4 font-medium text-slate-900">
                {workspaceStudentLabel(row)}
                {workspaceStudentNo(row) ? (
                  <span className="block text-xs text-slate-500">{workspaceStudentNo(row)}</span>
                ) : null}
              </td>
              <td className="py-2 pr-4">
                {row.registrationWindow.title}
                <span className="block text-xs text-slate-500">
                  {row.registrationWindow.examBoard.name}
                </span>
              </td>
              <td className="py-2 pr-4">{row.registrations.length}</td>
              <td className="py-2 pr-4">{workspaceStatus(row)}</td>
              <td className="py-2">{renderActions(row, "mixed")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <>
      <Card>
        <h2 className="mb-1 text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mb-3 text-sm text-slate-600">{description}</p>
        {actionError ? (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{actionError}</p>
        ) : null}
        {actionMessage ? (
          <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            {actionMessage}
          </p>
        ) : null}
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          <>
            <div className="overflow-x-auto">{renderTable(tableView)}</div>
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              loading={loading}
              itemLabel="registrations"
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </Card>

      {printModal ? (
        <RegistrationConfirmationPrintModal
          data={printModal.data}
          autoPrint={printModal.autoPrint}
          onClose={() => setPrintModal(null)}
        />
      ) : null}
    </>
  );
}
