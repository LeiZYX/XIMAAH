"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { FeeManagementNav } from "@/components/fees/FeeManagementNav";

interface FeeExportPageProps {
  basePath: "/admin" | "/exam-office";
}

export function FeeExportPage({ basePath }: FeeExportPageProps) {
  return (
    <div className="space-y-6">
      <FeeManagementNav basePath={basePath} />
      <PageHeader
        title="Export Fees"
        description="Export fee summary and details. Exports respect filters from the summary and details pages."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-semibold text-slate-900">Fee Summary</h2>
          <p className="text-sm text-slate-600">
            Aggregated totals grouped by window, grade, class, and subject.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/fees/export?type=summary&format=csv"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </a>
            <a
              href="/api/fees/export?type=summary&format=xlsx"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export Excel
            </a>
            <Link
              href={`${basePath}/fee-summary`}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
            >
              Apply filters first
            </Link>
          </div>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold text-slate-900">Fee Details</h2>
          <p className="text-sm text-slate-600">
            Line-level statement items with candidate and exam information.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/fees/export?type=details&format=csv"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </a>
            <a
              href="/api/fees/export?type=details&format=xlsx"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export Excel
            </a>
            <Link
              href={`${basePath}/fee-details`}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
            >
              Apply filters first
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
