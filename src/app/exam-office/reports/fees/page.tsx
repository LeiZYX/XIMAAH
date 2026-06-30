import { StaffReportPlaceholder } from "@/components/reports/StaffReportPlaceholder";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeFeeReportsPage() {
  return (
    <StaffReportPlaceholder
      title="Fee Reports"
      description="Combined fee reporting for registration and post-results statements."
    />
  );
}
