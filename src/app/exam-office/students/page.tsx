import { StudentManager } from "@/components/students/StudentManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
