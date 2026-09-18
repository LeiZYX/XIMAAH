import { StudentPortalIdentityBanner } from "@/components/student/StudentPortalIdentityBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { StudentFeeStatementsClient } from "./StudentFeeStatementsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function StudentFeeStatementsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My fee statements"
        description="View issued exam and cash-in fee statements and pay online in GBP via WeChat or Alipay."
      />
      <StudentPortalIdentityBanner />
      <StudentFeeStatementsClient />
    </div>
  );
}
