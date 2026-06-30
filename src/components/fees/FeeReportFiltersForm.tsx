"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { FeeReportFilters } from "@/lib/fees/filters";
import {
  RegistrationWindowSelectorFields,
  useRegistrationWindowSelector,
} from "@/components/registrations/RegistrationWindowSelector";

interface FeeReportFiltersFormProps {
  filters: FeeReportFilters;
  onChange: (filters: FeeReportFilters) => void;
  onSearch: () => void;
  showStatementStatus?: boolean;
  showBatchOptions?: boolean;
  requireRegistrationWindow?: boolean;
}

export function FeeReportFiltersForm({
  filters,
  onChange,
  onSearch,
  showStatementStatus = true,
  showBatchOptions = false,
  requireRegistrationWindow = false,
}: FeeReportFiltersFormProps) {
  const selector = useRegistrationWindowSelector({
    scope: "staff",
    initialRegistrationWindowId: filters.registrationWindowId ?? "",
    allowEmpty: !requireRegistrationWindow,
  });

  useEffect(() => {
    if (
      filters.registrationWindowId &&
      filters.registrationWindowId !== selector.registrationWindowId &&
      selector.windows.some((window) => window.id === filters.registrationWindowId)
    ) {
      selector.setRegistrationWindowId(filters.registrationWindowId);
    }
  }, [filters.registrationWindowId, selector]);

  const selectorForUi = useMemo(
    () => ({
      ...selector,
      setRegistrationWindowId: (id: string) => {
        selector.setRegistrationWindowId(id);
        onChange({ ...filters, registrationWindowId: id || undefined });
      },
      setAcademicYear: (year: string) => {
        selector.setAcademicYear(year);
        onChange({ ...filters, registrationWindowId: undefined });
      },
    }),
    [filters, onChange, selector],
  );

  const set = useCallback(
    (patch: Partial<FeeReportFilters>) => onChange({ ...filters, ...patch }),
    [filters, onChange],
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2 lg:col-span-2">
        <RegistrationWindowSelectorFields
          state={selectorForUi}
          layout="stacked"
          allowEmpty={!requireRegistrationWindow}
          emptyOptionLabel={
            requireRegistrationWindow ? "Select registration window *" : "All registration windows"
          }
          showStatus={false}
        />
        {requireRegistrationWindow && !filters.registrationWindowId ? (
          <p className="mt-1 text-xs text-amber-700">Registration window is required.</p>
        ) : null}
      </div>
      <input
        placeholder="Grade"
        value={filters.grade ?? ""}
        onChange={(e) => set({ grade: e.target.value || undefined })}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        placeholder="Class"
        value={filters.className ?? ""}
        onChange={(e) => set({ className: e.target.value || undefined })}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <select
        value={filters.candidateType ?? ""}
        onChange={(e) =>
          set({
            candidateType:
              e.target.value === "INTERNAL" || e.target.value === "EXTERNAL"
                ? e.target.value
                : undefined,
          })
        }
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">All candidate types</option>
        <option value="INTERNAL">Internal</option>
        <option value="EXTERNAL">External</option>
      </select>
      <select
        value={filters.registrationSource ?? ""}
        onChange={(e) => set({ registrationSource: (e.target.value || undefined) as never })}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">All registration sources</option>
        <option value="STUDENT_SUBMITTED">Student submitted</option>
        <option value="EO_ASSISTED">EO assisted</option>
        <option value="ADMIN_ASSISTED">Admin assisted</option>
        <option value="EXTERNAL_CANDIDATE">External candidate</option>
        <option value="EO_FORCED_INTERNAL">EO restricted</option>
        <option value="ADMIN_FORCED_INTERNAL">Admin restricted</option>
      </select>
      <select
        value={filters.visibility ?? ""}
        onChange={(e) => set({ visibility: (e.target.value || undefined) as never })}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">All visibility</option>
        <option value="STUDENT_AND_TEACHER">Student & teacher</option>
        <option value="STUDENT_ONLY">Student only</option>
        <option value="EXAM_OFFICE_ONLY">Restricted visibility</option>
      </select>
      <select
        value={filters.billingScope ?? ""}
        onChange={(e) => set({ billingScope: (e.target.value || undefined) as never })}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Default billing (normal)</option>
        <option value="NORMAL_BILLING">Normal billing</option>
        <option value="OFFICE_ONLY_BILLING">Restricted billing</option>
        <option value="MANUAL_REVIEW">Manual review</option>
      </select>
      {showStatementStatus ? (
        <select
          value={filters.statementStatus ?? ""}
          onChange={(e) => set({ statementStatus: (e.target.value || undefined) as never })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All statement statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ISSUED">Issued</option>
          <option value="PAID">Paid</option>
          <option value="NEEDS_REVIEW">Needs review</option>
        </select>
      ) : null}
      {showBatchOptions ? (
        <>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.includeExternal !== false}
              onChange={(e) => set({ includeExternal: e.target.checked })}
            />
            Include external candidates
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(filters.includeOfficeOnly)}
              onChange={(e) => set({ includeOfficeOnly: e.target.checked })}
            />
            Include restricted billing
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(filters.includeManualReview)}
              onChange={(e) => set({ includeManualReview: e.target.checked })}
            />
            Include manual review billing
          </label>
        </>
      ) : null}
      <button
        type="button"
        onClick={onSearch}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
      >
        Search
      </button>
    </div>
  );
}

export function filtersToParams(filters: FeeReportFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  return params.toString();
}
