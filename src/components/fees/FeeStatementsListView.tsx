"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { FeeManagementNav } from "@/components/fees/FeeManagementNav";
import { FeeStatementsBatchWidget } from "@/components/fees/FeeStatementsBatchWidget";
import {
  FEE_STATEMENT_TYPE_RADIO_LABELS,
  STAFF_REGISTRATION_TYPE_FILTERS,
  isStaffRegistrationTypeFilter,
  parseFeeStatementType,
  type StaffRegistrationTypeFilter,
} from "@/lib/registrations/workspace-type-filters";

interface FeeStatementsListViewProps {
  basePath: "/admin" | "/exam-office";
  windowsBasePath: string;
}

interface RegistrationWindowOption {
  id: string;
  title: string;
  status: string;
}

export function FeeStatementsListView({
  basePath,
  windowsBasePath,
}: FeeStatementsListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [windows, setWindows] = useState<RegistrationWindowOption[]>([]);
  const [windowsLoading, setWindowsLoading] = useState(true);
  const [windowId, setWindowIdState] = useState("");
  const [statementType, setStatementTypeState] = useState<StaffRegistrationTypeFilter>("NORMAL");

  const syncUrl = useCallback(
    (updates: { registrationWindowId?: string; statementType?: StaffRegistrationTypeFilter }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.registrationWindowId !== undefined) {
        if (updates.registrationWindowId) {
          params.set("registrationWindowId", updates.registrationWindowId);
        } else {
          params.delete("registrationWindowId");
        }
      }
      if (updates.statementType !== undefined) {
        if (updates.statementType === "NORMAL") {
          params.delete("statementType");
        } else {
          params.set("statementType", updates.statementType);
        }
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    setWindowsLoading(true);
    fetch("/api/registration-windows")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setWindows(list);

        const fromUrl = searchParams.get("registrationWindowId");
        const validFromUrl = fromUrl && list.some((window) => window.id === fromUrl) ? fromUrl : "";
        setWindowIdState(validFromUrl || list[0]?.id || "");
        setStatementTypeState(parseFeeStatementType(searchParams));
      })
      .catch(() => {
        setWindows([]);
        setWindowIdState("");
        setStatementTypeState("NORMAL");
      })
      .finally(() => setWindowsLoading(false));
  }, [searchParams]);

  const setWindowId = useCallback(
    (id: string) => {
      setWindowIdState(id);
      syncUrl({ registrationWindowId: id });
    },
    [syncUrl],
  );

  const setStatementType = useCallback(
    (type: StaffRegistrationTypeFilter) => {
      setStatementTypeState(type);
      syncUrl({ statementType: type });
    },
    [syncUrl],
  );

  return (
    <div className="space-y-6">
      <FeeManagementNav basePath={basePath} />
      <PageHeader
        title="Fee Statements"
        description="Select a registration window and statement type to generate, issue, and print fee statements or restricted invoices."
      />

      {windowsLoading ? (
        <Card className="text-sm text-slate-600">Loading registration windows…</Card>
      ) : windows.length === 0 ? (
        <Card className="text-sm text-slate-600">
          No registration windows yet. Create one under Registration Windows to manage fee statements
          here.
        </Card>
      ) : (
        <Card className="space-y-4">
          <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
            Registration window
            <select
              value={windowId}
              onChange={(e) => setWindowId(e.target.value)}
              className="min-w-[16rem] rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            >
              {windows.map((window) => (
                <option key={window.id} value={window.id}>
                  {window.title} ({window.status})
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Statement type</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {STAFF_REGISTRATION_TYPE_FILTERS.map((type) => (
                <label key={type} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="statementType"
                    value={type}
                    checked={statementType === type}
                    onChange={() => {
                      if (isStaffRegistrationTypeFilter(type)) {
                        setStatementType(type);
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
      )}

      {windowId ? (
        <FeeStatementsBatchWidget
          registrationWindowId={windowId}
          statementType={statementType}
          windowsBasePath={windowsBasePath}
        />
      ) : (
        <Card className="text-sm text-slate-600">
          Select a registration window to view and manage statements.
        </Card>
      )}
    </div>
  );
}
