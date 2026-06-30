"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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
  DEFAULT_STAFF_REGISTRATION_TYPES,
  REGISTRATION_TYPE_FILTER_LABELS,
  STAFF_REGISTRATION_TYPE_FILTERS,
  isStaffRegistrationTypeFilter,
  parseStaffRegistrationTypes,
  serializeStaffRegistrationTypes,
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
  registrationTypes: StaffRegistrationTypeFilter[];
  setRegistrationTypes: (types: StaffRegistrationTypeFilter[]) => void;
  toggleRegistrationType: (type: StaffRegistrationTypeFilter) => void;
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
    registrationTypes?: StaffRegistrationTypeFilter[];
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
  if (updates.registrationTypes !== undefined) {
    const serialized = serializeStaffRegistrationTypes(updates.registrationTypes);
    const isDefault =
      updates.registrationTypes.length === DEFAULT_STAFF_REGISTRATION_TYPES.length &&
      DEFAULT_STAFF_REGISTRATION_TYPES.every((type) => updates.registrationTypes!.includes(type));
    if (isDefault) {
      params.delete("registrationTypes");
    } else {
      params.set("registrationTypes", serialized);
    }
  }
  const query = params.toString();
  router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
}

export function RegistrationsRefreshProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0);
  const [registrationTypes, setRegistrationTypesState] = useState<StaffRegistrationTypeFilter[]>([
    ...DEFAULT_STAFF_REGISTRATION_TYPES,
  ]);

  const windowFromUrl = searchParams.get("registrationWindowId") ?? "";
  const yearFromUrl = searchParams.get("academicYear") ?? undefined;

  const windowSelector = useRegistrationWindowSelector({
    scope: "staff",
    initialAcademicYear: yearFromUrl,
    resolveRegistrationWindowId: windowFromUrl || null,
    initialRegistrationWindowId: windowFromUrl,
  });

  const bumpWorkspaceList = useCallback(() => {
    setWorkspaceRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    setRegistrationTypesState(parseStaffRegistrationTypes(searchParams));
  }, [searchParams]);

  useEffect(() => {
    if (!windowSelector.registrationWindowId) return;
    if (searchParams.get("registrationWindowId") === windowSelector.registrationWindowId) return;
    syncUrlParams(router, pathname, searchParams, {
      registrationWindowId: windowSelector.registrationWindowId,
      academicYear: windowSelector.academicYear,
    });
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

  const setRegistrationTypes = useCallback(
    (types: StaffRegistrationTypeFilter[]) => {
      const next =
        types.length > 0 ? types : [...DEFAULT_STAFF_REGISTRATION_TYPES];
      setRegistrationTypesState(next);
      syncUrlParams(router, pathname, searchParams, { registrationTypes: next });
    },
    [pathname, router, searchParams],
  );

  const toggleRegistrationType = useCallback(
    (type: StaffRegistrationTypeFilter) => {
      setRegistrationTypesState((current) => {
        const hasType = current.includes(type);
        const next = hasType
          ? current.filter((item) => item !== type)
          : [...current, type];
        const resolved =
          next.length > 0 ? next : [...DEFAULT_STAFF_REGISTRATION_TYPES];
        syncUrlParams(router, pathname, searchParams, { registrationTypes: resolved });
        return resolved;
      });
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
        registrationTypes,
        setRegistrationTypes,
        toggleRegistrationType,
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
      registrationTypes: [...DEFAULT_STAFF_REGISTRATION_TYPES],
      setRegistrationTypes: () => {},
      toggleRegistrationType: () => {},
      windows: [],
      windowsLoading: false,
      windowSelector: emptySelector,
    };
  }
  return context;
}

export function RegistrationWindowFilterBar() {
  const { registrationTypes, toggleRegistrationType, windows, windowsLoading, windowSelector } =
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

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Registration type</p>
        <div className="flex flex-wrap gap-2">
          {STAFF_REGISTRATION_TYPE_FILTERS.map((type) => {
            const selected = registrationTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleRegistrationType(type)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  selected
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-200"
                }`}
              >
                {REGISTRATION_TYPE_FILTER_LABELS[type]}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Default view shows normal internal students only. Select additional types to include
          restricted or external candidate registrations.
        </p>
      </div>
    </Card>
  );
}

export { isStaffRegistrationTypeFilter };
