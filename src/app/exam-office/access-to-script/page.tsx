import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeAccessToScriptPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Access to Script"
        description="Access to script requests are managed within review windows."
      />
      <Link href="/exam-office/review-windows" className="text-sm text-indigo-600 hover:underline">
        Go to review windows
      </Link>
    </div>
  );
}
