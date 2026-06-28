import { Suspense } from "react";
import { FeeDetailsView } from "@/components/fees/FeeDetailsView";

export default function AdminFeeDetailsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600">Loading fee details...</p>}>
      <FeeDetailsView basePath="/admin" />
    </Suspense>
  );
}
