import { RegistrationWindowDetailShell } from "@/components/registrations/RegistrationWindowDetailShell";

export default async function AdminRegistrationWindowLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RegistrationWindowDetailShell
      windowId={id}
      basePath="/admin/registration-windows"
      reportsBasePath="/admin/fee-summary"
      registrationsBasePath="/admin/registrations"
      feeStatementsBasePath="/admin/fee-statements"
    >
      {children}
    </RegistrationWindowDetailShell>
  );
}
