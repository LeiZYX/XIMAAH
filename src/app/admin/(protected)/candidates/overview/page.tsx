import { StudentOverviewPanel } from "@/components/students/StudentOverviewPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminStudentOverviewPage() {
  return (
    <StudentOverviewPanel
      apiPath="/api/admin/students/overview"
      detailBasePath="/admin/candidates"
      moduleBasePath="/admin/candidates"
    />
  );
}
