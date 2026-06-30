"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  RegistrationPrintButton,
  RegistrationConfirmationPrintModal,
  buildConfirmationPrintData,
} from "@/components/registrations/RegistrationConfirmationPrintModal";
import {
  formatWindowRange,
  groupExamsByBoardAndSubject,
  groupRegistrationsByWindow,
  isRegistrationWindowOpen,
  registrationStatusLabel,
  type StudentRegistrationRow,
  windowCardStatusClass,
} from "@/lib/registrations/student-groups";

interface StudentRegistrationGroupsProps {
  registrations: StudentRegistrationRow[];
  actionId: string | null;
  onRemove: (id: string) => void;
}

function WindowCard({
  group,
  actionId,
  onRemove,
}: {
  group: ReturnType<typeof groupRegistrationsByWindow>[number];
  actionId: string | null;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(group.cardStatus === "Open");
  const [printOpen, setPrintOpen] = useState(false);
  const boardGroups = useMemo(
    () => groupExamsByBoardAndSubject(group.registrations),
    [group.registrations],
  );
  const isOpen = group.cardStatus === "Open";
  const isLocked = group.cardStatus === "Locked";

  return (
    <Card
      className={`overflow-hidden p-0 ${isLocked ? "ring-2 ring-indigo-200 ring-inset" : ""}`}
    >
      {printOpen ? (
        <RegistrationConfirmationPrintModal
          data={{
            ...buildConfirmationPrintData(group, {
              id: group.workspaceId,
              hasPostLockAdjustment: group.hasPostLockAdjustment,
              lastAdjustedAt: group.lastAdjustedAt,
              lastAdjustedByUser: group.lastAdjustedByName ? { name: group.lastAdjustedByName } : null,
              lastAdjustedByRole: group.lastAdjustedByRole,
              lastAdjustmentReason: group.lastAdjustmentReason,
              lastAdjustmentSummary: group.lastAdjustmentSummary,
            }),
            postLockAdjustments: group.postLockAdjustments,
            isLateRegistration: group.isLateRegistration,
          }}
          onClose={() => setPrintOpen(false)}
        />
      ) : null}
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {group.boardSummary}
            </p>
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
              {group.window.title || group.examSeries.name}
            </h2>
            <p className="text-sm text-slate-600">
              {group.examSeries.name} ({group.examSeries.year})
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLocked ? (
              <RegistrationPrintButton onClick={() => setPrintOpen(true)} />
            ) : null}
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${windowCardStatusClass(group.cardStatus)}`}
            >
              {group.cardStatus}
            </span>
          </div>
        </div>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {group.registrationSource === "EO_ASSISTED" ||
          group.registrationSource === "ADMIN_ASSISTED" ||
          group.isLateRegistration ? (
            <div className="sm:col-span-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-indigo-900">
              Registered by Exams Office on behalf of student
              {group.lastAdjustedAt
                ? ` on ${new Date(group.lastAdjustedAt).toLocaleString()}`
                : ""}
              .
            </div>
          ) : null}
          {group.hasPostLockAdjustment && group.lastAdjustedAt && !group.isLateRegistration ? (
            <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              This registration was adjusted by the Exams Office on{" "}
              {new Date(group.lastAdjustedAt).toLocaleString()}.
            </div>
          ) : null}
          <div>
            <dt className="text-slate-500">Registration window</dt>
            <dd className="font-medium text-slate-800">
              {formatWindowRange(group.window.studentRegistrationOpenAt, group.window.registrationCloseAt)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Selected exams</dt>
            <dd className="font-medium text-slate-800">{group.registrations.length}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Last updated</dt>
            <dd className="font-medium text-slate-800">
              {new Date(group.lastUpdatedAt).toLocaleString()}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {isOpen ? (
            <Link
              href="/calendar"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Edit Registration
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {expanded ? "Hide Details" : "View Details"}
            </button>
          )}
          <Link
            href="/calendar?view=my"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View My Calendar
          </Link>
        </div>
      </div>

      {expanded ? (
        <div className="space-y-5 px-4 py-4 sm:px-5">
          {boardGroups.map((board) => (
            <div key={board.boardName}>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">{board.boardName}</h3>
              <div className="space-y-3">
                {board.subjects.map((subject) => (
                  <div key={subject.subjectName}>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {subject.subjectName}
                    </p>
                    <ul className="space-y-2">
                      {subject.exams.map((exam) => {
                        const editable =
                          exam.status === "ACTIVE" &&
                          isRegistrationWindowOpen(exam.registrationWindow);

                        return (
                          <li
                            key={exam.id}
                            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                          >
                            <div>
                              <p className="font-medium text-slate-900">
                                {exam.paper.code}
                                {exam.paper.title ? ` · ${exam.paper.title}` : ""}
                              </p>
                              <p className="text-sm text-slate-600">
                                {exam.examSession.date.slice(0, 10)}
                                {exam.examSession.startTime
                                  ? ` · ${exam.examSession.startTime}`
                                  : ""}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {registrationStatusLabel(exam.status)}
                              </p>
                            </div>
                            {editable ? (
                              <button
                                type="button"
                                disabled={actionId === exam.id}
                                onClick={() => onRemove(exam.id)}
                                className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                Remove
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

export function StudentRegistrationGroups({
  registrations,
  actionId,
  onRemove,
}: StudentRegistrationGroupsProps) {
  const groups = useMemo(() => groupRegistrationsByWindow(registrations), [registrations]);

  if (groups.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          You have not selected any exams yet. Browse the{" "}
          <Link href="/calendar" className="text-indigo-600 hover:text-indigo-700">
            calendar
          </Link>{" "}
          to add exams during an open registration window.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <WindowCard
          key={group.windowId}
          group={group}
          actionId={actionId}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
