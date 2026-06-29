import { RegistrationFeeStagesPanel } from "@/components/registrations/RegistrationFeeStagesPanel";

export default async function ExamOfficeRegistrationWindowFeeStagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RegistrationFeeStagesPanel windowId={id} />;
}
