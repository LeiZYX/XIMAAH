import { RegistrationWindowManager } from "@/components/registrations/RegistrationWindowManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeRegistrationWindowsPage() {
  return <RegistrationWindowManager basePath="/exam-office/registration-windows" />;
}
