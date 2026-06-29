import { RegistrationFeeStagesPanel } from "@/components/registrations/RegistrationFeeStagesPanel";

export default async function AdminRegistrationWindowFeeStagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RegistrationFeeStagesPanel windowId={id} />;
}
