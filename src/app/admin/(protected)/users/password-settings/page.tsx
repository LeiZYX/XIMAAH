import { PasswordSettingsPanel } from "@/components/users/PasswordSettingsPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminPasswordSettingsPage() {
  return <PasswordSettingsPanel />;
}
