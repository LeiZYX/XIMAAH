import { RegistrationWindowGeneral } from "@/components/registrations/RegistrationWindowGeneral";

export default async function ExamOfficeRegistrationWindowGeneralPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RegistrationWindowGeneral windowId={id} />;
}
