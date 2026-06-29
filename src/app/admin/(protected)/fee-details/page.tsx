import { Suspense } from "react";
import { FeeDetailsView } from "@/components/fees/FeeDetailsView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminFeeDetailsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600">Loading fee details...</p>}>
      <FeeDetailsView basePath="/admin" />
    </Suspense>
  );
}
