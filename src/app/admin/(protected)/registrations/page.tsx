import { Suspense } from "react";
import { RegistrationList } from "@/components/registrations/RegistrationList";
import { PendingTeacherChangeRequests } from "@/components/registrations/PendingTeacherChangeRequests";
import { PendingStudentAdjustmentRequests } from "@/components/registrations/PendingStudentAdjustmentRequests";
import { AddRegistrationDropdown } from "@/components/registrations/AddRegistrationDropdown";
import { RegistrationWorkspaceList } from "@/components/registrations/RegistrationWorkspaceList";
import { RegistrationsRefreshProvider, RegistrationWindowFilterBar } from "@/components/registrations/registrations-refresh";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminRegistrationsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading registrations…</p>}>
      <RegistrationsRefreshProvider>
        <div className="space-y-6">
        <PageHeader title="Student registrations" description="View, adjust, and export exam registrations." />
        <RegistrationWindowFilterBar />
        <p className="text-sm">
        <a href="/admin/users/students" className="text-indigo-600 hover:underline">
          Manage student accounts (graduate, archive, reactivate)
        </a>
      </p>
      <PendingTeacherChangeRequests
        apiPath="/api/admin/change-requests"
        detailBasePath="/admin/registrations"
        approveApiBase="/api/admin/change-requests"
      />
      <PendingStudentAdjustmentRequests
        apiPath="/api/admin/student-adjustment-requests"
        approveApiBase="/api/admin/student-adjustment-requests"
        status="PENDING_EO"
        title="Pending student adjustment requests"
        description="Second-step approval for student late adjustments. Approving applies the changes and may require regenerating the fee statement."
        detailBasePath="/admin/registrations"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div />
        <AddRegistrationDropdown
          assistedApiPath="/api/admin/assisted-registrations"
          officeOnlyApiPath="/api/admin/office-only-registrations"
          externalApiPath="/api/admin/external-candidate-registrations"
          lateRegistrationApiPath="/api/admin/late-registrations"
          workspacesApiPath="/api/admin/registrations/workspaces"
          detailBasePath="/admin/registrations"
          candidateDetailBasePath="/admin/candidates"
        />
      </div>
      <RegistrationWorkspaceList apiPath="/api/admin/registrations/workspaces" detailBasePath="/admin/registrations" />
      <RegistrationList apiPath="/api/admin/registrations" exportPath="/api/admin/registrations" />
        </div>
      </RegistrationsRefreshProvider>
    </Suspense>
  );
}
