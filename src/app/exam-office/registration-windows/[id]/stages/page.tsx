import { RegistrationStagesPanel } from "@/components/registrations/RegistrationStagesPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExamOfficeRegistrationWindowStagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RegistrationStagesPanel windowId={id} />;
}
