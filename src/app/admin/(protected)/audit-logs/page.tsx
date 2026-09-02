import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { CashInAuditLogPanel } from "@/components/cash-in/CashInAuditLogPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminAuditLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Domain audit activity. Cash-in fee and post-results entries are listed below."
      />
      <p className="text-sm text-slate-600">
        Registration window and review window detail pages still host their own scoped audit tabs.
        Cash-in offline payment and request status changes appear here and on{" "}
        <Link href="/admin/cash-in-requests" className="text-indigo-700 hover:underline">
          Cash-in Requests
        </Link>
        .
      </p>
      <CashInAuditLogPanel title="Cash-in / post-results fee audits" limit={100} />
    </div>
  );
}
