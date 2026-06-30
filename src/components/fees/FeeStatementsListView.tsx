"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { FeeManagementNav } from "@/components/fees/FeeManagementNav";
import { FeeStatementsBatchWidget } from "@/components/fees/FeeStatementsBatchWidget";
import {
  RegistrationWindowSelectorFields,
  useRegistrationWindowSelector,
} from "@/components/registrations/RegistrationWindowSelector";
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

export function FeeStatementsListView({
  basePath,
  windowsBasePath,
}: FeeStatementsListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [statementType, setStatementTypeState] = useState<StaffRegistrationTypeFilter>("INTERNAL_NORMAL");

  const windowFromUrl = searchParams.get("registrationWindowId") ?? "";
  const yearFromUrl = searchParams.get("academicYear") ?? undefined;

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
      statementType?: StaffRegistrationTypeFilter;
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
      if (updates.statementType !== undefined) {
        if (updates.statementType === "INTERNAL_NORMAL") {
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
    setStatementTypeState(parseFeeStatementType(searchParams));
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

      {selector.loading && selector.yearsLoading ? (
        <Card className="text-sm text-slate-600">Loading registration windows…</Card>
      ) : selector.windows.length === 0 ? (
        <Card className="space-y-3">
          <RegistrationWindowSelectorFields state={selectorForUi} layout="inline" />
          <p className="text-sm text-slate-600">
            No registration windows for this academic year. Create one under Registration Windows or
            choose another academic year.
          </p>
        </Card>
      ) : (
        <Card className="space-y-4">
          <RegistrationWindowSelectorFields state={selectorForUi} layout="inline" />

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

      {selector.registrationWindowId ? (
        <FeeStatementsBatchWidget
          registrationWindowId={selector.registrationWindowId}
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
