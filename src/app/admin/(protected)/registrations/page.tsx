import { RegistrationList } from "@/components/registrations/RegistrationList";
import { PendingTeacherChangeRequests } from "@/components/registrations/PendingTeacherChangeRequests";
import { AddRegistrationDropdown } from "@/components/registrations/AddRegistrationDropdown";
import { RegistrationWorkspaceList } from "@/components/registrations/RegistrationWorkspaceList";
import { RegistrationsRefreshProvider } from "@/components/registrations/registrations-refresh";
import { RegistrationFeeBatchWidget } from "@/components/fees/RegistrationFeeBatchWidget";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminRegistrationsPage() {
  return (
    <RegistrationsRefreshProvider>
      <div className="space-y-6">
      <PageHeader title="Student registrations" description="View, adjust, and export exam registrations." />
      <p className="text-sm">
        <a href="/admin/students" className="text-indigo-600 hover:underline">
          Manage students (graduate, archive, reactivate)
        </a>
      </p>
      <PendingTeacherChangeRequests
        apiPath="/api/admin/change-requests"
        detailBasePath="/admin/registrations"
        approveApiBase="/api/admin/change-requests"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div />
        <AddRegistrationDropdown
          assistedApiPath="/api/admin/assisted-registrations"
          officeOnlyApiPath="/api/admin/office-only-registrations"
          externalApiPath="/api/admin/external-candidate-registrations"
          workspacesApiPath="/api/admin/registrations/workspaces"
          detailBasePath="/admin/registrations"
        />
      </div>
      <RegistrationWorkspaceList apiPath="/api/admin/registrations/workspaces" detailBasePath="/admin/registrations" />
      <RegistrationFeeBatchWidget feeRulesBasePath="/admin/registration-windows" />
      <RegistrationList apiPath="/api/admin/registrations" exportPath="/api/admin/registrations" />
      </div>
    </RegistrationsRefreshProvider>
  );
}
