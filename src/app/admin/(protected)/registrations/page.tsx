import { RegistrationList } from "@/components/registrations/RegistrationList";
import { PendingTeacherChangeRequests } from "@/components/registrations/PendingTeacherChangeRequests";
import { HelpStudentRegisterButton } from "@/components/registrations/HelpStudentRegisterButton";
import { RegistrationWorkspaceList } from "@/components/registrations/RegistrationWorkspaceList";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AdminRegistrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Student registrations" description="View, adjust, and export exam registrations." />
      <PendingTeacherChangeRequests
        apiPath="/api/admin/change-requests"
        detailBasePath="/admin/registrations"
        approveApiBase="/api/admin/change-requests"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div />
        <HelpStudentRegisterButton
          apiPath="/api/admin/late-registrations"
          detailBasePath="/admin/registrations"
        />
      </div>
      <RegistrationWorkspaceList apiPath="/api/admin/registrations/workspaces" detailBasePath="/admin/registrations" />
      <RegistrationList apiPath="/api/admin/registrations" exportPath="/api/admin/registrations" />
    </div>
  );
}
