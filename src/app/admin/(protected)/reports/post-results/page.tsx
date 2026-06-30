import { StaffReportPlaceholder } from "@/components/reports/StaffReportPlaceholder";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminPostResultsReportsPage() {
  return (
    <StaffReportPlaceholder
      title="Post-Results Reports"
      description="Post-results service reporting across review windows."
    />
  );
}
