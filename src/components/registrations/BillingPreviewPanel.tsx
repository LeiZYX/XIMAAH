"use client";

import { useMemo, useState } from "react";
import { SalesAmountDisplay } from "@/components/fees/SalesAmountDisplay";
import type { FeeStatementDisplayCurrencyOption } from "@/lib/fees/display-currency";
import {
  RegistrationItemCard,
  RegistrationItemMeta,
} from "@/components/registrations/RegistrationItemCard";

export interface BillingPreviewLine {
  id: string;
  kind: "EXAM_ENTRY" | "CANDIDATE_REGISTRATION";
  serviceName: string;
  boardName: string;
  salesGbp: number;
  salesCny: number;
  feeScheduleVersion?: number | null;
  status: "ACTIVE" | "PENDING_ADD" | "PENDING_REMOVE";
  subjectName?: string;
  paperCode?: string;
}

interface BillingPreviewPanelProps {
  lines: BillingPreviewLine[];
  displayCurrency: FeeStatementDisplayCurrencyOption;
  loading?: boolean;
}

function statusBadge(status: BillingPreviewLine["status"]) {
  switch (status) {
    case "PENDING_ADD":
      return "Pending Add" as const;
    case "PENDING_REMOVE":
      return "Pending Remove" as const;
    default:
      return null;
  }
}

export function BillingPreviewPanel({
  lines,
  displayCurrency,
  loading = false,
}: BillingPreviewPanelProps) {
  const [query, setQuery] = useState("");

  const filteredLines = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((line) => {
      const haystack = [
        line.serviceName,
        line.boardName,
        line.subjectName,
        line.paperCode,
        line.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [lines, query]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Loading billing preview…
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
        No billable items selected yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Billing Preview</h3>
        {lines.length > 3 ? (
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search service, subject, or paper"
            className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        ) : null}
      </div>

      <div className="space-y-3">
        {filteredLines.length === 0 ? (
          <p className="text-sm text-slate-500">No billing items match your search.</p>
        ) : (
          filteredLines.map((line) => (
            <RegistrationItemCard
              key={line.id}
              title={line.serviceName}
              badge={statusBadge(line.status)}
              muted={line.status === "PENDING_REMOVE"}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <RegistrationItemMeta label="Board" value={line.boardName} />
                {line.kind === "EXAM_ENTRY" ? (
                  <RegistrationItemMeta
                    label="Subject / Paper"
                    value={`${line.subjectName ?? "—"}${line.paperCode ? ` · ${line.paperCode}` : ""}`}
                  />
                ) : (
                  <RegistrationItemMeta
                    label="Fee schedule"
                    value={line.feeScheduleVersion ? `v${line.feeScheduleVersion}` : "—"}
                  />
                )}
                <SalesAmountDisplay
                  amounts={{ salesGbp: line.salesGbp, salesCny: line.salesCny }}
                  displayCurrency={displayCurrency}
                  className="sm:col-span-2"
                />
              </div>
            </RegistrationItemCard>
          ))
        )}
      </div>
    </div>
  );
}
