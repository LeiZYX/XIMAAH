import { RegistrationStagesPanel } from "@/components/registrations/RegistrationStagesPanel";

export default async function AdminRegistrationWindowStagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RegistrationStagesPanel windowId={id} />;
}
