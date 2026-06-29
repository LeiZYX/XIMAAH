import { RegistrationWindowGeneral } from "@/components/registrations/RegistrationWindowGeneral";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminRegistrationWindowGeneralPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RegistrationWindowGeneral windowId={id} />;
}
