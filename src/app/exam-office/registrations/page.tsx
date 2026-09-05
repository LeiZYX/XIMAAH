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

export default function ExamOfficeRegistrationsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading registrations…</p>}>
      <RegistrationsRefreshProvider>
        <div className="space-y-6">
        <PageHeader title="Registrations" description="View, adjust, and export student exam registrations." />
        <RegistrationWindowFilterBar />
        <p className="text-sm">
        <a href="/exam-office/candidates" className="text-indigo-600 hover:underline">
          Manage candidates (internal & external)
        </a>
      </p>
      <PendingTeacherChangeRequests
        apiPath="/api/exam-office/change-requests"
        detailBasePath="/exam-office/registrations"
        approveApiBase="/api/exam-office/change-requests"
      />
      <PendingStudentAdjustmentRequests
        apiPath="/api/exam-office/student-adjustment-requests"
        approveApiBase="/api/exam-office/student-adjustment-requests"
        status="PENDING_EO"
        title="Pending student adjustment requests"
        description="Second-step approval for student late adjustments. Approving applies the changes and may require regenerating the fee statement."
        detailBasePath="/exam-office/registrations"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div />
        <AddRegistrationDropdown
          assistedApiPath="/api/exam-office/assisted-registrations"
          officeOnlyApiPath="/api/exam-office/office-only-registrations"
          externalApiPath="/api/exam-office/external-candidate-registrations"
          lateRegistrationApiPath="/api/exam-office/late-registrations"
          workspacesApiPath="/api/admin/registrations/workspaces"
          detailBasePath="/exam-office/registrations"
          candidateDetailBasePath="/exam-office/candidates"
        />
      </div>
      <RegistrationWorkspaceList apiPath="/api/admin/registrations/workspaces" detailBasePath="/exam-office/registrations" />
      <RegistrationList
        apiPath="/api/exam-office/registrations"
        exportPath="/api/exam-office/registrations"
      />
        </div>
      </RegistrationsRefreshProvider>
    </Suspense>
  );
}
