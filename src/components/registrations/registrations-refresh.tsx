"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Card } from "@/components/ui/Card";
import {
  DEFAULT_STAFF_REGISTRATION_TYPES,
  REGISTRATION_TYPE_FILTER_LABELS,
  STAFF_REGISTRATION_TYPE_FILTERS,
  isStaffRegistrationTypeFilter,
  parseStaffRegistrationTypes,
  serializeStaffRegistrationTypes,
  type StaffRegistrationTypeFilter,
} from "@/lib/registrations/workspace-type-filters";

export interface RegistrationWindowOption {
  id: string;
  title: string;
  status: string;
}

interface RegistrationsRefreshContextValue {
  workspaceRefreshKey: number;
  bumpWorkspaceList: () => void;
  registrationWindowId: string;
  setRegistrationWindowId: (id: string) => void;
  registrationTypes: StaffRegistrationTypeFilter[];
  setRegistrationTypes: (types: StaffRegistrationTypeFilter[]) => void;
  toggleRegistrationType: (type: StaffRegistrationTypeFilter) => void;
  windows: RegistrationWindowOption[];
  windowsLoading: boolean;
}

const RegistrationsRefreshContext = createContext<RegistrationsRefreshContextValue | null>(null);

function syncUrlParams(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  searchParams: URLSearchParams,
  updates: { registrationWindowId?: string; registrationTypes?: StaffRegistrationTypeFilter[] },
) {
  const params = new URLSearchParams(searchParams.toString());
  if (updates.registrationWindowId !== undefined) {
    if (updates.registrationWindowId) {
      params.set("registrationWindowId", updates.registrationWindowId);
    } else {
      params.delete("registrationWindowId");
    }
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
  const [windows, setWindows] = useState<RegistrationWindowOption[]>([]);
  const [windowsLoading, setWindowsLoading] = useState(true);
  const [registrationWindowId, setRegistrationWindowIdState] = useState("");
  const [registrationTypes, setRegistrationTypesState] = useState<StaffRegistrationTypeFilter[]>([
    ...DEFAULT_STAFF_REGISTRATION_TYPES,
  ]);

  const bumpWorkspaceList = useCallback(() => {
    setWorkspaceRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    setWindowsLoading(true);
    fetch("/api/registration-windows")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setWindows(list);

        const fromUrl = searchParams.get("registrationWindowId");
        const validFromUrl = fromUrl && list.some((window) => window.id === fromUrl) ? fromUrl : "";
        setRegistrationWindowIdState(validFromUrl || list[0]?.id || "");
        setRegistrationTypesState(parseStaffRegistrationTypes(searchParams));
      })
      .catch(() => {
        setWindows([]);
        setRegistrationWindowIdState("");
        setRegistrationTypesState([...DEFAULT_STAFF_REGISTRATION_TYPES]);
      })
      .finally(() => setWindowsLoading(false));
  }, [searchParams]);

  const setRegistrationWindowId = useCallback(
    (id: string) => {
      setRegistrationWindowIdState(id);
      syncUrlParams(router, pathname, searchParams, { registrationWindowId: id });
    },
    [pathname, router, searchParams],
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

  return (
    <RegistrationsRefreshContext.Provider
      value={{
        workspaceRefreshKey,
        bumpWorkspaceList,
        registrationWindowId,
        setRegistrationWindowId,
        registrationTypes,
        setRegistrationTypes,
        toggleRegistrationType,
        windows,
        windowsLoading,
      }}
    >
      {children}
    </RegistrationsRefreshContext.Provider>
  );
}

export function useRegistrationsRefresh(): RegistrationsRefreshContextValue {
  const context = useContext(RegistrationsRefreshContext);
  if (!context) {
    return {
      workspaceRefreshKey: 0,
      bumpWorkspaceList: () => {},
      registrationWindowId: "",
      setRegistrationWindowId: () => {},
      registrationTypes: [...DEFAULT_STAFF_REGISTRATION_TYPES],
      setRegistrationTypes: () => {},
      toggleRegistrationType: () => {},
      windows: [],
      windowsLoading: false,
    };
  }
  return context;
}

export function RegistrationWindowFilterBar() {
  const {
    registrationWindowId,
    setRegistrationWindowId,
    registrationTypes,
    toggleRegistrationType,
    windows,
    windowsLoading,
  } = useRegistrationsRefresh();

  if (windowsLoading) {
    return <Card className="text-sm text-slate-600">Loading registration windows…</Card>;
  }

  if (windows.length === 0) {
    return (
      <Card className="text-sm text-slate-600">
        No registration windows yet. Create one under Registration Windows to manage
        registrations and fee statements here.
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
          Registration window
          <select
            value={registrationWindowId}
            onChange={(event) => setRegistrationWindowId(event.target.value)}
            className="min-w-[16rem] rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
          >
            {windows.map((window) => (
              <option key={window.id} value={window.id}>
                {window.title} ({window.status})
              </option>
            ))}
          </select>
        </label>
      </div>

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

// Keep parse helper available for client components that read URL directly
export { isStaffRegistrationTypeFilter };
