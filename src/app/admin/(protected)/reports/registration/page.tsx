import { StaffReportPlaceholder } from "@/components/reports/StaffReportPlaceholder";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminRegistrationReportsPage() {
  return (
    <StaffReportPlaceholder
      title="Registration Reports"
      description="Pre-exam registration reporting across registration windows."
    />
  );
}
