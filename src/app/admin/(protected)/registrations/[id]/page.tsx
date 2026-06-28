import { RegistrationWorkspaceDetail } from "@/components/registrations/RegistrationWorkspaceDetail";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function AdminRegistrationWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registration detail"
        description="Review and adjust a locked student registration."
      />
      <RegistrationWorkspaceDetail
        workspaceId={id}
        apiBase="/api/admin/registrations"
        backHref="/admin/registrations"
        canAdjust
        feeRulesHrefBase="/admin/registration-windows"
      />
    </div>
  );
}
