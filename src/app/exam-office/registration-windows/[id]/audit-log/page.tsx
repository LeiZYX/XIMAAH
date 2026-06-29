import { RegistrationWindowAuditLog } from "@/components/registrations/RegistrationWindowAuditLog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExamOfficeRegistrationWindowAuditLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RegistrationWindowAuditLog windowId={id} />;
}
