import { RegistrationFeeStagesPanel } from "@/components/registrations/RegistrationFeeStagesPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExamOfficeRegistrationWindowFeeStagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RegistrationFeeStagesPanel windowId={id} />;
}
