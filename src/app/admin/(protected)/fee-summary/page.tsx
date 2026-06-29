import { FeeSummaryView } from "@/components/fees/FeeSummaryView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminFeeSummaryPage() {
  return <FeeSummaryView basePath="/admin" />;
}
