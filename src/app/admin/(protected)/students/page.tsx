import { StudentManager } from "@/components/students/StudentManager";

export default function AdminStudentsPage() {
  return (
    <StudentManager
      apiPath="/api/admin/students"
      actionApiPath="/api/admin/students"
      canReactivate
    />
  );
}
