import { RegistrationWindowDetailShell } from "@/components/registrations/RegistrationWindowDetailShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExamOfficeRegistrationWindowLayout({
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
      basePath="/exam-office/registration-windows"
      reportsBasePath="/exam-office/fee-summary"
      registrationsBasePath="/exam-office/registrations"
      feeStatementsBasePath="/exam-office/fee-statements"
    >
      {children}
    </RegistrationWindowDetailShell>
  );
}
