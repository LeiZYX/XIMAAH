import { RegistrationWindowFeeRules } from "@/components/fees/RegistrationWindowFeeRules";
import { examOfficerCanConfigureFeeRules } from "@/lib/config/fees";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExamOfficeRegistrationWindowFeesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const canConfigure = examOfficerCanConfigureFeeRules();

  return (
    <RegistrationWindowFeeRules
      windowId={id}
      basePath="/exam-office/registration-windows"
      canConfigure={canConfigure}
      showCosts={canConfigure}
    />
  );
}
