import { StudentManager } from "@/components/students/StudentManager";

export default function ExamOfficeStudentsPage() {
  return (
    <StudentManager
      apiPath="/api/exam-office/students"
      actionApiPath="/api/admin/students"
      canReactivate={false}
      canManageArchive={false}
    />
  );
}
