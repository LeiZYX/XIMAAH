import { StudentManager } from "@/components/students/StudentManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminStudentsPage() {
  return (
    <StudentManager
      apiPath="/api/admin/students"
      actionApiPath="/api/admin/students"
      canReactivate
    />
  );
}
