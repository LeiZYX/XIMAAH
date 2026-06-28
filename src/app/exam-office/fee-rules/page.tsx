import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { FeeManagementNav } from "@/components/fees/FeeManagementNav";

export default function ExamOfficeFeeRulesPage() {
  return (
    <div className="space-y-6">
      <FeeManagementNav basePath="/exam-office" />
      <PageHeader
        title="Fee Rules"
        description="Configure fee rules and exchange rates per registration window."
      />
      <Card>
        <p className="text-sm text-slate-600">
          Fee rules are managed per registration window. Open a window and go to its Fee Rules tab.
        </p>
        <Link
          href="/exam-office/registration-windows"
          className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          Open Registration Windows
        </Link>
      </Card>
    </div>
  );
}
