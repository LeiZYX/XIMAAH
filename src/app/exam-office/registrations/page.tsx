import { RegistrationList } from "@/components/registrations/RegistrationList";
import { PendingTeacherChangeRequests } from "@/components/registrations/PendingTeacherChangeRequests";
import { HelpStudentRegisterButton } from "@/components/registrations/HelpStudentRegisterButton";
import { RegistrationWorkspaceList } from "@/components/registrations/RegistrationWorkspaceList";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ExamOfficeRegistrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Registrations" description="View, adjust, and export student exam registrations." />
      <PendingTeacherChangeRequests
        apiPath="/api/exam-office/change-requests"
        detailBasePath="/exam-office/registrations"
        approveApiBase="/api/exam-office/change-requests"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div />
        <HelpStudentRegisterButton
          apiPath="/api/exam-office/late-registrations"
          detailBasePath="/exam-office/registrations"
        />
      </div>
      <RegistrationWorkspaceList apiPath="/api/admin/registrations/workspaces" detailBasePath="/exam-office/registrations" />
      <RegistrationList
        apiPath="/api/exam-office/registrations"
        exportPath="/api/exam-office/registrations"
      />
    </div>
  );
}
