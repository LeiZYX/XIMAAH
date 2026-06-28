import { Suspense } from "react";
import { FeeStatementsListView } from "@/components/fees/FeeStatementsListView";

export default function AdminFeeStatementsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600">Loading fee statements...</p>}>
      <FeeStatementsListView
        basePath="/admin"
        windowsBasePath="/admin/registration-windows"
      />
    </Suspense>
  );
}
