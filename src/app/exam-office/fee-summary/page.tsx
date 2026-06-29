import { FeeSummaryView } from "@/components/fees/FeeSummaryView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeFeeSummaryPage() {
  return <FeeSummaryView basePath="/exam-office" />;
}
