import { FeeExportPage } from "@/components/fees/FeeExportPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function FinanceFeesExportPage() {
  return <FeeExportPage basePath="/finance" />;
}
