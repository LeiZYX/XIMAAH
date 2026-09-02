import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeCashInRequestsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash-in Requests"
        description="Request workflow arrives in a later phase. Configure official cash-in codes first."
      />
      <div className="space-y-2 text-sm">
        <p>
          <Link href="/exam-office/cash-in-codes" className="text-indigo-600 hover:underline">
            Go to Cash-in Codes
          </Link>
        </p>
        <p className="text-slate-600">
          Cash-in will not depend on review windows. Pricing and student billing come in later
          phases.
        </p>
      </div>
    </div>
  );
}
