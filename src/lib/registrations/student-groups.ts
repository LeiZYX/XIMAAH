import type { RegistrationWindowStatus } from "@/generated/prisma/enums";
import type { AdjustmentHistoryBatch } from "@/lib/registrations/adjustment-history";

export interface StudentRegistrationRow {
  id: string;
  status: string;
  updatedAt: string;
  lockedAt: string | null;
  studentNameSnapshot?: string;
  studentNoSnapshot?: string;
  gradeSnapshot?: string;
  classNameSnapshot?: string;
  emailSnapshot?: string | null;
  assessmentHubCandidateNumberSnapshot?: string | null;
  candidateTypeSnapshot?: string | null;
  registrationSource?: string;
  examBoard: { name: string; code: string };
  examSeries: { name: string; year: number };
  subject: { name: string; code: string };
  paper: { code: string; title: string; duration?: number | null };
  examSession: {
    date: string;
    startTime: string | null;
    endTime?: string | null;
    venue?: string | null;
  };
  registrationWindow: {
    id: string;
    title: string;
    status: RegistrationWindowStatus | string;
    studentRegistrationOpenAt: string;
    studentRegistrationCloseAt: string;
    registrationCloseAt: string;
  };
  registrationWorkspace?: {
    id: string;
    hasPostLockAdjustment: boolean;
    isLateRegistration?: boolean;
    registrationSource?: string;
    lastAdjustedAt: string | null;
    lastAdjustmentReason: string | null;
    lastAdjustmentSummary: string | null;
    lastAdjustedByRole: string | null;
    lastAdjustedByUser: { name: string } | null;
    postLockAdjustments?: Array<{
      adjustedAt: string;
      adjustedByName: string;
      adjustedByRole: string;
      reason: string;
      added: Array<{ subject: string; paperCode: string; paperTitle: string }>;
      removed: Array<{ subject: string; paperCode: string; paperTitle: string }>;
      replaced: Array<{
        from: { subject: string; paperCode: string; paperTitle: string };
        to: { subject: string; paperCode: string; paperTitle: string };
      }>;
    }>;
  } | null;
}

export type WindowCardStatus = "Open" | "Closed" | "Locked";

export function isRegistrationWindowOpen(
  window: StudentRegistrationRow["registrationWindow"],
  now = Date.now(),
): boolean {
  if (window.status !== "OPEN") return false;
  return (
    now >= new Date(window.studentRegistrationOpenAt).getTime() &&
    now <= new Date(window.registrationCloseAt).getTime()
  );
}

export function registrationStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Selected";
    case "LOCKED":
      return "Locked after deadline";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function windowCardStatus(
  window: StudentRegistrationRow["registrationWindow"],
  registrations: StudentRegistrationRow[],
): WindowCardStatus {
  const open = isRegistrationWindowOpen(window);
  const allLocked = registrations.every((row) => row.status === "LOCKED");
  const anyActive = registrations.some((row) => row.status === "ACTIVE");

  if (open && anyActive) return "Open";
  if (allLocked) return "Locked";
  return "Closed";
}

export function formatWindowRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const sameYear = start.getFullYear() === end.getFullYear();
  const dateFmt: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  };
  const timeFmt: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  return `${start.toLocaleDateString(undefined, dateFmt)} ${start.toLocaleTimeString(undefined, timeFmt)} – ${end.toLocaleDateString(undefined, dateFmt)} ${end.toLocaleTimeString(undefined, timeFmt)}`;
}

export function summarizeExamBoards(registrations: StudentRegistrationRow[]): string {
  const boards = [...new Set(registrations.map((row) => row.examBoard.name))];
  if (boards.length === 0) return "—";
  if (boards.length === 1) return boards[0];
  return "Mixed exam boards";
}

export interface RegistrationWindowGroup {
  windowId: string;
  workspaceId?: string;
  window: StudentRegistrationRow["registrationWindow"];
  examSeries: StudentRegistrationRow["examSeries"];
  registrations: StudentRegistrationRow[];
  lastUpdatedAt: string;
  cardStatus: WindowCardStatus;
  boardSummary: string;
  hasPostLockAdjustment?: boolean;
  isLateRegistration?: boolean;
  registrationSource?: string;
  lastAdjustedAt?: string | null;
  lastAdjustedByName?: string | null;
  lastAdjustedByRole?: string | null;
  lastAdjustmentReason?: string | null;
  lastAdjustmentSummary?: string | null;
  postLockAdjustments?: AdjustmentHistoryBatch[];
}

export function groupRegistrationsByWindow(
  registrations: StudentRegistrationRow[],
): RegistrationWindowGroup[] {
  const map = new Map<string, RegistrationWindowGroup>();

  for (const row of registrations) {
    const key = row.registrationWindow.id;
    const existing = map.get(key);
    const workspace = (row as StudentRegistrationRow & {
      registrationWorkspace?: {
        id: string;
        hasPostLockAdjustment: boolean;
        isLateRegistration?: boolean;
        lastAdjustedAt: string | null;
        lastAdjustmentReason: string | null;
        lastAdjustmentSummary: string | null;
        lastAdjustedByRole: string | null;
        lastAdjustedByUser: { name: string } | null;
        registrationSource?: string;
        postLockAdjustments?: AdjustmentHistoryBatch[];
      } | null;
    }).registrationWorkspace;

    if (existing) {
      existing.registrations.push(row);
      if (new Date(row.updatedAt) > new Date(existing.lastUpdatedAt)) {
        existing.lastUpdatedAt = row.updatedAt;
      }
    } else {
      map.set(key, {
        windowId: key,
        workspaceId: workspace?.id,
        window: row.registrationWindow,
        examSeries: row.examSeries,
        registrations: [row],
        lastUpdatedAt: row.updatedAt,
        cardStatus: "Closed",
        boardSummary: "",
        hasPostLockAdjustment: workspace?.hasPostLockAdjustment ?? false,
        isLateRegistration: workspace?.isLateRegistration ?? false,
        registrationSource: workspace?.registrationSource ?? row.registrationSource,
        lastAdjustedAt: workspace?.lastAdjustedAt ?? null,
        lastAdjustedByName: workspace?.lastAdjustedByUser?.name ?? null,
        lastAdjustedByRole: workspace?.lastAdjustedByRole ?? null,
        lastAdjustmentReason: workspace?.lastAdjustmentReason ?? null,
        lastAdjustmentSummary: workspace?.lastAdjustmentSummary ?? null,
        postLockAdjustments: workspace?.postLockAdjustments ?? [],
      });
    }
  }

  const groups = [...map.values()].map((group) => ({
    ...group,
    cardStatus: windowCardStatus(group.window, group.registrations),
    boardSummary: summarizeExamBoards(group.registrations),
  }));

  return groups.sort(
    (a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime(),
  );
}

export function groupExamsByBoardAndSubject(registrations: StudentRegistrationRow[]) {
  const boards = new Map<string, Map<string, StudentRegistrationRow[]>>();

  for (const row of registrations) {
    const boardKey = row.examBoard.name;
    if (!boards.has(boardKey)) boards.set(boardKey, new Map());
    const subjects = boards.get(boardKey)!;
    const subjectKey = row.subject.name;
    subjects.set(subjectKey, [...(subjects.get(subjectKey) ?? []), row]);
  }

  return [...boards.entries()].map(([boardName, subjects]) => ({
    boardName,
    subjects: [...subjects.entries()].map(([subjectName, exams]) => ({
      subjectName,
      exams,
    })),
  }));
}

export function windowCardStatusClass(status: WindowCardStatus): string {
  switch (status) {
    case "Open":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "Locked":
      return "bg-indigo-50 text-indigo-800 ring-indigo-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export function getStudentSnapshotFromRegistrations(registrations: StudentRegistrationRow[]) {
  const row = registrations[0];
  if (!row) {
    return {
      name: "—",
      grade: "—",
      className: "—",
      studentNo: "—",
      email: "—",
      assessmentHubCandidateNumber: "—",
      candidateType: "—",
    };
  }

  return {
    name: row.studentNameSnapshot ?? "—",
    grade: row.gradeSnapshot ?? "—",
    className: row.classNameSnapshot ?? "—",
    studentNo: row.studentNoSnapshot ?? "—",
    email: row.emailSnapshot ?? "—",
    assessmentHubCandidateNumber: row.assessmentHubCandidateNumberSnapshot ?? "—",
    candidateType: row.candidateTypeSnapshot ?? "—",
  };
}

export function getGroupLockedOn(registrations: StudentRegistrationRow[]): string | null {
  const lockedTimes = registrations
    .map((row) => row.lockedAt)
    .filter((value): value is string => Boolean(value));

  if (lockedTimes.length === 0) return null;

  return lockedTimes.reduce((latest, current) =>
    new Date(current) > new Date(latest) ? current : latest,
  );
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins} min`;
}

export function formatExamDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatExamSessionLabel(
  examSession: StudentRegistrationRow["examSession"],
): string {
  if (examSession.venue?.trim()) return examSession.venue.trim();
  if (examSession.startTime) {
    const hour = Number.parseInt(examSession.startTime.split(":")[0] ?? "", 10);
    if (!Number.isNaN(hour)) return hour < 12 ? "Morning" : "Afternoon";
  }
  return "—";
}

export function sortRegistrationsForPrint(
  registrations: StudentRegistrationRow[],
): StudentRegistrationRow[] {
  return [...registrations].sort((a, b) => {
    const dateCompare =
      new Date(a.examSession.date).getTime() - new Date(b.examSession.date).getTime();
    if (dateCompare !== 0) return dateCompare;

    const subjectCompare = a.subject.name.localeCompare(b.subject.name);
    if (subjectCompare !== 0) return subjectCompare;

    return a.paper.code.localeCompare(b.paper.code);
  });
}
