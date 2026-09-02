"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BoardSubmissionsAmendmentTab } from "@/components/board-submissions/BoardSubmissionsAmendmentTab";
import { BoardSubmissionsBulkEntriesTab } from "@/components/board-submissions/BoardSubmissionsBulkEntriesTab";
import { BoardSubmissionsStatusBar } from "@/components/board-submissions/BoardSubmissionsStatusBar";
import { BoardSubmissionsSummaryCards } from "@/components/board-submissions/BoardSubmissionsSummaryCards";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  RegistrationWindowSelectorFields,
  useRegistrationWindowSelector,
} from "@/components/registrations/RegistrationWindowSelector";
import type { BoardSubmissionWindowSummary, BoardSubmissionsTab } from "@/lib/board-submissions/types";

interface BoardSubmissionsViewProps {
  basePath: "/admin" | "/exam-office";
}

function parseTab(value: string | null): BoardSubmissionsTab {
  return value === "amendment" ? "amendment" : "bulk-entries";
}

export function BoardSubmissionsView({ basePath }: BoardSubmissionsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const windowFromUrl = searchParams.get("registrationWindowId") ?? "";
  const yearFromUrl = searchParams.get("academicYear") ?? undefined;
  const tabFromUrl = parseTab(searchParams.get("tab"));

  const [activeTab, setActiveTab] = useState<BoardSubmissionsTab>(tabFromUrl);
  const [summary, setSummary] = useState<BoardSubmissionWindowSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const selector = useRegistrationWindowSelector({
    scope: "staff",
    initialAcademicYear: yearFromUrl,
    resolveRegistrationWindowId: windowFromUrl || null,
    initialRegistrationWindowId: windowFromUrl,
  });

  const syncUrl = useCallback(
    (updates: {
      registrationWindowId?: string;
      academicYear?: string;
      tab?: BoardSubmissionsTab;
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.registrationWindowId !== undefined) {
        if (updates.registrationWindowId) {
          params.set("registrationWindowId", updates.registrationWindowId);
        } else {
          params.delete("registrationWindowId");
        }
      }
      if (updates.academicYear !== undefined) {
        params.set("academicYear", updates.academicYear);
      }
      if (updates.tab !== undefined) {
        if (updates.tab === "bulk-entries") {
          params.delete("tab");
        } else {
          params.set("tab", updates.tab);
        }
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    setActiveTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    if (!selector.registrationWindowId) return;
    if (searchParams.get("registrationWindowId") === selector.registrationWindowId) return;
    syncUrl({
      registrationWindowId: selector.registrationWindowId,
      academicYear: selector.academicYear,
    });
  }, [searchParams, selector.academicYear, selector.registrationWindowId, syncUrl]);

  const selectorForUi = useMemo(
    () => ({
      ...selector,
      setAcademicYear: (year: string) => {
        selector.setAcademicYear(year);
        syncUrl({ academicYear: year, registrationWindowId: "" });
      },
      setRegistrationWindowId: (id: string) => {
        selector.setRegistrationWindowId(id);
        syncUrl({ registrationWindowId: id, academicYear: selector.academicYear });
      },
    }),
    [selector, syncUrl],
  );

  const loadSummary = useCallback(async (registrationWindowId: string) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await fetch(
        `/api/board-submissions/summary?registrationWindowId=${encodeURIComponent(registrationWindowId)}`,
      );
      const data = (await response.json()) as BoardSubmissionWindowSummary & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load board submission summary");
      }
      setSummary(data);
    } catch (error) {
      setSummary(null);
      setSummaryError(error instanceof Error ? error.message : "Failed to load summary");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selector.registrationWindowId) {
      setSummary(null);
      setSummaryError(null);
      return;
    }
    void loadSummary(selector.registrationWindowId);
  }, [loadSummary, selector.registrationWindowId]);

  function setTab(tab: BoardSubmissionsTab) {
    setActiveTab(tab);
    syncUrl({ tab });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Board Submissions"
        description="Prepare official exam-board submission files, track baseline versions, and monitor registration and billing readiness for each window."
      />

      {selector.loading && selector.yearsLoading ? (
        <Card className="text-sm text-slate-600">Loading registration windows…</Card>
      ) : (
        <Card>
          <RegistrationWindowSelectorFields state={selectorForUi} />
        </Card>
      )}

      {!selector.registrationWindowId ? (
        <Card className="text-sm text-slate-600">
          Select a registration window to view submission status and exports.
        </Card>
      ) : summaryLoading && !summary ? (
        <Card className="text-sm text-slate-600">Loading window summary…</Card>
      ) : summaryError ? (
        <Card className="text-sm text-red-600">{summaryError}</Card>
      ) : summary ? (
        <>
          <BoardSubmissionsStatusBar summary={summary} />
          <BoardSubmissionsSummaryCards
            registration={summary.registration}
            financial={summary.financial}
          />

          <div className="border-b border-slate-200">
            <nav className="-mb-px flex gap-6">
              <button
                type="button"
                onClick={() => setTab("bulk-entries")}
                className={`border-b-2 px-1 pb-3 text-sm font-medium transition ${
                  activeTab === "bulk-entries"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                Bulk Entries
              </button>
              <button
                type="button"
                onClick={() => setTab("amendment")}
                className={`border-b-2 px-1 pb-3 text-sm font-medium transition ${
                  activeTab === "amendment"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                Amendment
              </button>
            </nav>
          </div>

          {activeTab === "bulk-entries" ? (
            <BoardSubmissionsBulkEntriesTab
              summary={summary}
              basePath={basePath}
              onSubmitted={() => void loadSummary(selector.registrationWindowId)}
            />
          ) : (
            <BoardSubmissionsAmendmentTab summary={summary} />
          )}
        </>
      ) : null}
    </div>
  );
}
