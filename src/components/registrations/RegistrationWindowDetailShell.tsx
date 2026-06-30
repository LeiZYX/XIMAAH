"use client";

import { ReactNode, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { IncludedExamSessionsList } from "@/components/registrations/IncludedExamSessionsList";
import { RegistrationWindowDetailNav } from "@/components/registrations/RegistrationWindowDetailNav";
import type { IncludedExamSession } from "@/lib/registrations/included-series";

interface WindowInfo {
  id: string;
  title: string;
  examBoard?: { id: string; name: string; code: string };
  includedExamSessions?: IncludedExamSession[];
}

interface RegistrationWindowDetailShellProps {
  windowId: string;
  basePath: "/admin/registration-windows" | "/exam-office/registration-windows";
  reportsBasePath: "/admin/fee-summary" | "/exam-office/fee-summary";
  registrationsBasePath: "/admin/registrations" | "/exam-office/registrations";
  feeStatementsBasePath: "/admin/fee-statements" | "/exam-office/fee-statements";
  children: ReactNode;
}

export function RegistrationWindowDetailShell({
  windowId,
  basePath,
  reportsBasePath,
  registrationsBasePath,
  feeStatementsBasePath,
  children,
}: RegistrationWindowDetailShellProps) {
  const [windowInfo, setWindowInfo] = useState<WindowInfo | null>(null);

  useEffect(() => {
    fetch(`/api/registration-windows/${windowId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setWindowInfo(data));
  }, [windowId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={windowInfo?.title ?? "Registration window"}
        description={
          windowInfo?.examBoard
            ? `${windowInfo.examBoard.name} · manage settings, included sessions, and fee stages.`
            : "Manage registration window settings, included exam sessions, and fee stages."
        }
      />

      {windowInfo ? (
        <div className="border border-slate-200 bg-white px-4 py-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Exam board
              </p>
              <p className="font-medium text-slate-900">{windowInfo.examBoard?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Included sessions
              </p>
              <IncludedExamSessionsList
                sessions={windowInfo.includedExamSessions ?? []}
                compact
              />
            </div>
          </div>
        </div>
      ) : null}

      <RegistrationWindowDetailNav
        windowId={windowId}
        basePath={basePath}
        reportsBasePath={reportsBasePath}
        registrationsBasePath={registrationsBasePath}
        feeStatementsBasePath={feeStatementsBasePath}
      />

      {children}
    </div>
  );
}
