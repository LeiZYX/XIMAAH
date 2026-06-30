"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCurrentAcademicYear,
  mergeAcademicYearOptions,
} from "@/lib/registrations/academic-year";
import type { RegistrationWindowListScope } from "@/lib/registrations/window-list-scope";

export interface RegistrationWindowOption {
  id: string;
  title: string;
  status: string;
  academicYear?: string;
  examBoard?: { id: string; name: string; code?: string };
  examSeries?: { id: string; name: string; year: number };
}

export interface UseRegistrationWindowSelectorOptions {
  scope?: RegistrationWindowListScope;
  initialRegistrationWindowId?: string;
  initialAcademicYear?: string;
  resolveRegistrationWindowId?: string | null;
  allowEmpty?: boolean;
}

export interface UseRegistrationWindowSelectorResult {
  academicYear: string;
  setAcademicYear: (year: string) => void;
  academicYears: string[];
  registrationWindowId: string;
  setRegistrationWindowId: (id: string) => void;
  windows: RegistrationWindowOption[];
  selectedWindow: RegistrationWindowOption | null;
  loading: boolean;
  yearsLoading: boolean;
}

function buildWindowsUrl(academicYear: string, scope?: RegistrationWindowListScope): string {
  const params = new URLSearchParams({ academicYear });
  if (scope) params.set("scope", scope);
  return `/api/registration-windows?${params.toString()}`;
}

export function useRegistrationWindowSelector(
  options: UseRegistrationWindowSelectorOptions = {},
): UseRegistrationWindowSelectorResult {
  const {
    scope,
    initialRegistrationWindowId = "",
    initialAcademicYear,
    resolveRegistrationWindowId,
    allowEmpty = false,
  } = options;

  const [academicYear, setAcademicYearState] = useState(
    initialAcademicYear ?? getCurrentAcademicYear(),
  );
  const [academicYears, setAcademicYears] = useState<string[]>([getCurrentAcademicYear()]);
  const [registrationWindowId, setRegistrationWindowIdState] = useState(initialRegistrationWindowId);
  const [windows, setWindows] = useState<RegistrationWindowOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearsLoading, setYearsLoading] = useState(true);
  const resolvedRef = useRef(false);
  const pendingWindowIdRef = useRef<string | null>(
    resolveRegistrationWindowId || initialRegistrationWindowId || null,
  );

  useEffect(() => {
    setYearsLoading(true);
    fetch("/api/registration-windows?yearsOnly=true")
      .then((response) => (response.ok ? response.json() : { years: [] }))
      .then((data) => {
        const years = Array.isArray(data?.years) ? (data.years as string[]) : [];
        setAcademicYears(mergeAcademicYearOptions(years));
      })
      .catch(() => setAcademicYears(mergeAcademicYearOptions([])))
      .finally(() => setYearsLoading(false));
  }, []);

  useEffect(() => {
    if (resolvedRef.current || !resolveRegistrationWindowId) return;
    resolvedRef.current = true;
    const params = new URLSearchParams({ resolveWindowId: resolveRegistrationWindowId });
    fetch(`/api/registration-windows?${params.toString()}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.academicYear && typeof data.academicYear === "string") {
          setAcademicYearState(data.academicYear);
          pendingWindowIdRef.current = resolveRegistrationWindowId;
        }
      });
  }, [resolveRegistrationWindowId]);

  useEffect(() => {
    setLoading(true);
    fetch(buildWindowsUrl(academicYear, scope))
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? (data as RegistrationWindowOption[]) : [];
        setWindows(list);

        const pendingId = pendingWindowIdRef.current;
        pendingWindowIdRef.current = null;

        const preferredId =
          pendingId && list.some((window) => window.id === pendingId)
            ? pendingId
            : registrationWindowId && list.some((window) => window.id === registrationWindowId)
              ? registrationWindowId
              : "";

        let nextId = preferredId;
        if (!nextId && !allowEmpty) {
          nextId = list.length === 1 ? list[0]!.id : list[0]?.id ?? "";
        }
        setRegistrationWindowIdState(nextId);
      })
      .catch(() => {
        setWindows([]);
        if (!allowEmpty) setRegistrationWindowIdState("");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload windows when academic year or scope changes
  }, [academicYear, scope, allowEmpty]);

  const setAcademicYear = useCallback((year: string) => {
    setAcademicYearState(year);
    setRegistrationWindowIdState("");
    pendingWindowIdRef.current = null;
  }, []);

  const setRegistrationWindowId = useCallback((id: string) => {
    setRegistrationWindowIdState(id);
  }, []);

  const selectedWindow = useMemo(
    () => windows.find((window) => window.id === registrationWindowId) ?? null,
    [windows, registrationWindowId],
  );

  return {
    academicYear,
    setAcademicYear,
    academicYears,
    registrationWindowId,
    setRegistrationWindowId,
    windows,
    selectedWindow,
    loading,
    yearsLoading,
  };
}

const selectClassName =
  "min-w-[10rem] rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-normal text-slate-900";

export interface RegistrationWindowSelectorFieldsProps {
  state: UseRegistrationWindowSelectorResult;
  className?: string;
  layout?: "stacked" | "inline";
  showStatus?: boolean;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyOptionLabel?: string;
}

export function RegistrationWindowSelectorFields({
  state,
  className = "",
  layout = "stacked",
  showStatus = true,
  disabled = false,
  allowEmpty = false,
  emptyOptionLabel = "Select registration window",
}: RegistrationWindowSelectorFieldsProps) {
  const yearSelect = (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      Academic Year
      <select
        value={state.academicYear}
        onChange={(event) => state.setAcademicYear(event.target.value)}
        disabled={disabled || state.yearsLoading}
        className={selectClassName}
      >
        {state.academicYears.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );

  const windowSelect = (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      Registration Window
      <select
        value={state.registrationWindowId}
        onChange={(event) => state.setRegistrationWindowId(event.target.value)}
        disabled={disabled || state.loading || state.windows.length === 0}
        className={selectClassName}
      >
        {allowEmpty ? <option value="">{emptyOptionLabel}</option> : null}
        {state.windows.map((window) => (
          <option key={window.id} value={window.id}>
            {window.title}
            {showStatus ? ` (${window.status})` : ""}
          </option>
        ))}
      </select>
    </label>
  );

  if (layout === "inline") {
    return (
      <div className={`flex flex-wrap items-end gap-3 ${className}`}>
        {yearSelect}
        {windowSelect}
      </div>
    );
  }

  return (
    <div className={`grid gap-3 sm:grid-cols-2 sm:max-w-2xl ${className}`}>
      {yearSelect}
      {windowSelect}
    </div>
  );
}

export interface RegistrationWindowSelectorProps extends UseRegistrationWindowSelectorOptions {
  className?: string;
  layout?: "stacked" | "inline";
  showStatus?: boolean;
  disabled?: boolean;
  emptyOptionLabel?: string;
  selectorState?: UseRegistrationWindowSelectorResult;
}

export function RegistrationWindowSelector(props: RegistrationWindowSelectorProps) {
  if (props.selectorState) {
    return <RegistrationWindowSelectorFields {...props} state={props.selectorState} />;
  }
  return <RegistrationWindowSelectorWithHook {...props} />;
}

function RegistrationWindowSelectorWithHook({
  selectorState: _ignored,
  ...props
}: RegistrationWindowSelectorProps) {
  const state = useRegistrationWindowSelector(props);
  return <RegistrationWindowSelectorFields {...props} state={state} />;
}
