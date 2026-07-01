"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import { Card } from "@/components/ui/Card";
import {
  RegistrationWindowSelectorFields,
  useRegistrationWindowSelector,
  type RegistrationWindowOption,
  type UseRegistrationWindowSelectorResult,
} from "@/components/registrations/RegistrationWindowSelector";
import {
  FEE_STATEMENT_TYPE_RADIO_LABELS,
  STAFF_REGISTRATION_TYPE_FILTERS,
  isStaffRegistrationTypeFilter,
  parseStaffRegistrationType,
  type StaffRegistrationTypeFilter,
} from "@/lib/registrations/workspace-type-filters";

export type { RegistrationWindowOption };

interface RegistrationsRefreshContextValue {
  workspaceRefreshKey: number;
  bumpWorkspaceList: () => void;
  registrationWindowId: string;
  setRegistrationWindowId: (id: string) => void;
  academicYear: string;
  setAcademicYear: (year: string) => void;
  registrationType: StaffRegistrationTypeFilter;
  setRegistrationType: (type: StaffRegistrationTypeFilter) => void;
  registrationTypes: StaffRegistrationTypeFilter[];
  windows: RegistrationWindowOption[];
  windowsLoading: boolean;
  windowSelector: UseRegistrationWindowSelectorResult;
}

const RegistrationsRefreshContext = createContext<RegistrationsRefreshContextValue | null>(null);

function syncUrlParams(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  searchParams: URLSearchParams,
  updates: {
    registrationWindowId?: string;
    academicYear?: string;
    registrationType?: StaffRegistrationTypeFilter;
  },
) {
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
  if (updates.registrationType !== undefined) {
    params.delete("registrationTypes");
    if (updates.registrationType === "INTERNAL_NORMAL") {
      params.delete("type");
    } else {
      params.set("type", updates.registrationType);
    }
  }
  const query = params.toString();
  startTransition(() => {
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  });
}

export function RegistrationsRefreshProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0);
  const [registrationType, setRegistrationTypeState] =
    useState<StaffRegistrationTypeFilter>("INTERNAL_NORMAL");

  const windowFromUrl = searchParams.get("registrationWindowId") ?? "";
  const yearFromUrl = searchParams.get("academicYear") ?? undefined;

  const windowSelector = useRegistrationWindowSelector({
    scope: "staff",
    initialAcademicYear: yearFromUrl,
    resolveRegistrationWindowId: windowFromUrl || null,
    initialRegistrationWindowId: windowFromUrl,
  });

  const registrationTypes = useMemo(() => [registrationType], [registrationType]);

  const bumpWorkspaceList = useCallback(() => {
    setWorkspaceRefreshKey((current) => current + 1);
  }, []);

  const urlSyncReadyRef = useRef(false);
  useEffect(() => {
    urlSyncReadyRef.current = true;
  }, []);

  useEffect(() => {
    setRegistrationTypeState(parseStaffRegistrationType(searchParams));
  }, [searchParams]);

  useEffect(() => {
    if (!urlSyncReadyRef.current) return;
    if (!windowSelector.registrationWindowId) return;
    if (searchParams.get("registrationWindowId") === windowSelector.registrationWindowId) return;

    const timer = window.setTimeout(() => {
      syncUrlParams(router, pathname, searchParams, {
        registrationWindowId: windowSelector.registrationWindowId,
        academicYear: windowSelector.academicYear,
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    pathname,
    router,
    searchParams,
    windowSelector.academicYear,
    windowSelector.registrationWindowId,
  ]);

  const setRegistrationWindowId = useCallback(
    (id: string) => {
      windowSelector.setRegistrationWindowId(id);
      syncUrlParams(router, pathname, searchParams, {
        registrationWindowId: id,
        academicYear: windowSelector.academicYear,
      });
    },
    [pathname, router, searchParams, windowSelector],
  );

  const setAcademicYear = useCallback(
    (year: string) => {
      windowSelector.setAcademicYear(year);
      syncUrlParams(router, pathname, searchParams, {
        academicYear: year,
        registrationWindowId: "",
      });
    },
    [pathname, router, searchParams, windowSelector],
  );

  const setRegistrationType = useCallback(
    (type: StaffRegistrationTypeFilter) => {
      setRegistrationTypeState(type);
      syncUrlParams(router, pathname, searchParams, { registrationType: type });
    },
    [pathname, router, searchParams],
  );

  const selectorForUi = useMemo(
    (): UseRegistrationWindowSelectorResult => ({
      ...windowSelector,
      setAcademicYear: (year: string) => {
        windowSelector.setAcademicYear(year);
        syncUrlParams(router, pathname, searchParams, {
          academicYear: year,
          registrationWindowId: "",
        });
      },
      setRegistrationWindowId: (id: string) => {
        windowSelector.setRegistrationWindowId(id);
        syncUrlParams(router, pathname, searchParams, {
          registrationWindowId: id,
          academicYear: windowSelector.academicYear,
        });
      },
    }),
    [pathname, router, searchParams, windowSelector],
  );

  return (
    <RegistrationsRefreshContext.Provider
      value={{
        workspaceRefreshKey,
        bumpWorkspaceList,
        registrationWindowId: windowSelector.registrationWindowId,
        setRegistrationWindowId,
        academicYear: windowSelector.academicYear,
        setAcademicYear,
        registrationType,
        setRegistrationType,
        registrationTypes,
        windows: windowSelector.windows,
        windowsLoading: windowSelector.loading,
        windowSelector: selectorForUi,
      }}
    >
      {children}
    </RegistrationsRefreshContext.Provider>
  );
}

export function useRegistrationsRefresh(): RegistrationsRefreshContextValue {
  const context = useContext(RegistrationsRefreshContext);
  if (!context) {
    const emptySelector = {
      academicYear: "",
      setAcademicYear: () => {},
      academicYears: [],
      registrationWindowId: "",
      setRegistrationWindowId: () => {},
      windows: [],
      selectedWindow: null,
      loading: false,
      yearsLoading: false,
    };
    return {
      workspaceRefreshKey: 0,
      bumpWorkspaceList: () => {},
      registrationWindowId: "",
      setRegistrationWindowId: () => {},
      academicYear: "",
      setAcademicYear: () => {},
      registrationType: "INTERNAL_NORMAL",
      setRegistrationType: () => {},
      registrationTypes: ["INTERNAL_NORMAL"],
      windows: [],
      windowsLoading: false,
      windowSelector: emptySelector,
    };
  }
  return context;
}

export function RegistrationWindowFilterBar() {
  const { registrationType, setRegistrationType, windows, windowsLoading, windowSelector } =
    useRegistrationsRefresh();

  if (windowsLoading && windowSelector.yearsLoading) {
    return <Card className="text-sm text-slate-600">Loading registration windows…</Card>;
  }

  return (
    <Card className="space-y-4">
      <RegistrationWindowSelectorFields state={windowSelector} layout="inline" />

      {windows.length === 0 ? (
        <p className="text-sm text-slate-600">
          No registration windows for this academic year. Choose another academic year to view
          historical windows.
        </p>
      ) : null}

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Registration type</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {STAFF_REGISTRATION_TYPE_FILTERS.map((type) => (
            <label key={type} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="registrationType"
                value={type}
                checked={registrationType === type}
                onChange={() => {
                  if (isStaffRegistrationTypeFilter(type)) {
                    setRegistrationType(type);
                  }
                }}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              {FEE_STATEMENT_TYPE_RADIO_LABELS[type]}
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}

export { isStaffRegistrationTypeFilter };
