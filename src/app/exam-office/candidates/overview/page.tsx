import { StudentOverviewPanel } from "@/components/students/StudentOverviewPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeStudentOverviewPage() {
  return (
    <StudentOverviewPanel
      apiPath="/api/exam-office/students/overview"
      detailBasePath="/exam-office/candidates"
      moduleBasePath="/exam-office/candidates"
    />
  );
}
