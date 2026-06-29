"use client";

import { ReactNode, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { RegistrationWindowDetailNav } from "@/components/registrations/RegistrationWindowDetailNav";

interface WindowInfo {
  id: string;
  title: string;
  examBoard: { code: string; name: string };
  examSeries: { name: string; year: number };
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
          windowInfo
            ? `${windowInfo.examBoard.code} · ${windowInfo.examSeries.name} (${windowInfo.examSeries.year})`
            : "Manage registration window settings and stages."
        }
      />

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
