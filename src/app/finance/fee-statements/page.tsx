import { Suspense } from "react";
import { FeeStatementsListView } from "@/components/fees/FeeStatementsListView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function FinanceFeeStatementsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600">Loading fee statements...</p>}>
      <FeeStatementsListView basePath="/finance" windowsBasePath="" />
    </Suspense>
  );
}
