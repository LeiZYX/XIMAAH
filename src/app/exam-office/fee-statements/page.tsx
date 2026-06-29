import { Suspense } from "react";
import { FeeStatementsListView } from "@/components/fees/FeeStatementsListView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeFeeStatementsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600">Loading fee statements...</p>}>
      <FeeStatementsListView
        basePath="/exam-office"
        windowsBasePath="/exam-office/registration-windows"
      />
    </Suspense>
  );
}
