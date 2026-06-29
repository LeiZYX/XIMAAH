import { RegistrationWindowAuditLog } from "@/components/registrations/RegistrationWindowAuditLog";

export default async function AdminRegistrationWindowAuditLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RegistrationWindowAuditLog windowId={id} />;
}
