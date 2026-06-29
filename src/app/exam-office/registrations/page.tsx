import { RegistrationList } from "@/components/registrations/RegistrationList";
import { PendingTeacherChangeRequests } from "@/components/registrations/PendingTeacherChangeRequests";
import { AddRegistrationDropdown } from "@/components/registrations/AddRegistrationDropdown";
import { RegistrationWorkspaceList } from "@/components/registrations/RegistrationWorkspaceList";
import { RegistrationsRefreshProvider } from "@/components/registrations/registrations-refresh";
import { RegistrationFeeBatchWidget } from "@/components/fees/RegistrationFeeBatchWidget";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeRegistrationsPage() {
  return (
    <RegistrationsRefreshProvider>
      <div className="space-y-6">
      <PageHeader title="Registrations" description="View, adjust, and export student exam registrations." />
      <p className="text-sm">
        <a href="/exam-office/candidates" className="text-indigo-600 hover:underline">
          Manage candidates (internal & external)
        </a>
        {" · "}
        <a href="/exam-office/students" className="text-indigo-600 hover:underline">
          View students by status (active, graduated, left)
        </a>
      </p>
      <PendingTeacherChangeRequests
        apiPath="/api/exam-office/change-requests"
        detailBasePath="/exam-office/registrations"
        approveApiBase="/api/exam-office/change-requests"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div />
        <AddRegistrationDropdown
          assistedApiPath="/api/exam-office/assisted-registrations"
          officeOnlyApiPath="/api/exam-office/office-only-registrations"
          externalApiPath="/api/exam-office/external-candidate-registrations"
          workspacesApiPath="/api/admin/registrations/workspaces"
          detailBasePath="/exam-office/registrations"
        />
      </div>
      <RegistrationWorkspaceList apiPath="/api/admin/registrations/workspaces" detailBasePath="/exam-office/registrations" />
      <RegistrationFeeBatchWidget feeRulesBasePath="/exam-office/registration-windows" />
      <RegistrationList
        apiPath="/api/exam-office/registrations"
        exportPath="/api/exam-office/registrations"
      />
      </div>
    </RegistrationsRefreshProvider>
  );
}
