import { FeeExportPage } from "@/components/fees/FeeExportPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeFeesExportPage() {
  return <FeeExportPage basePath="/exam-office" />;
}
