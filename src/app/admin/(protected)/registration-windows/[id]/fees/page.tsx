import { RegistrationWindowFeeRules } from "@/components/fees/RegistrationWindowFeeRules";

export default async function AdminRegistrationWindowFeesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RegistrationWindowFeeRules
      windowId={id}
      basePath="/admin/registration-windows"
      canConfigure
      showCosts
    />
  );
}
