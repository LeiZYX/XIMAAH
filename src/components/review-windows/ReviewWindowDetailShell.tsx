"use client";

import { ReactNode, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReviewWindowDetailNav } from "@/components/review-windows/ReviewWindowDetailNav";
import { reviewWindowStatusLabel } from "@/lib/post-results/constants";

interface WindowInfo {
  id: string;
  title: string;
  status: string;
  openAt: string;
  closeAt: string;
  resultsReleaseDate?: string | null;
  examBoard?: { id: string; name: string; code: string };
  examSeries?: { id: string; name: string; year: number };
}

export interface ReviewWindowDetailShellProps {
  windowId: string;
  basePath: "/admin/review-windows" | "/exam-office/review-windows";
  feeStatementsBasePath: "/admin/fee-statements" | "/exam-office/fee-statements";
  children: ReactNode;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ReviewWindowDetailShell({
  windowId,
  basePath,
  feeStatementsBasePath,
  children,
}: ReviewWindowDetailShellProps) {
  const [windowInfo, setWindowInfo] = useState<WindowInfo | null>(null);

  useEffect(() => {
    fetch(`/api/review-windows/${windowId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setWindowInfo(data));
  }, [windowId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={windowInfo?.title ?? "Review window"}
        description={
          windowInfo?.examBoard
            ? `${windowInfo.examBoard.name} · post-results services window`
            : "Manage post-results services for an exam series."
        }
      />

      {windowInfo ? (
        <div className="border border-slate-200 bg-white px-4 py-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Exam board
              </p>
              <p className="font-medium text-slate-900">{windowInfo.examBoard?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Exam series
              </p>
              <p className="font-medium text-slate-900">
                {windowInfo.examSeries
                  ? `${windowInfo.examSeries.name} (${windowInfo.examSeries.year})`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </p>
              <p className="font-medium text-slate-900">
                {reviewWindowStatusLabel(windowInfo.status)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Results release
              </p>
              <p className="font-medium text-slate-900">
                {formatDate(windowInfo.resultsReleaseDate)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open</p>
              <p className="font-medium text-slate-900">{formatDate(windowInfo.openAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Close</p>
              <p className="font-medium text-slate-900">{formatDate(windowInfo.closeAt)}</p>
            </div>
          </div>
        </div>
      ) : null}

      <ReviewWindowDetailNav
        windowId={windowId}
        basePath={basePath}
        feeStatementsBasePath={feeStatementsBasePath}
      />

      {children}
    </div>
  );
}
