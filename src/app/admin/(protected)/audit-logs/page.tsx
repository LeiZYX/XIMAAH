import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminAuditLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Central audit log search across registration windows, review windows, and fee activity."
      />
      <p className="text-sm text-slate-600">
        Use registration window or review window detail pages for domain-specific audit logs. A
        unified search view will be added in a future release.
      </p>
    </div>
  );
}
