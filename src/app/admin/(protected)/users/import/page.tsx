import { UserImportExportPanel } from "@/components/users/UserImportExportPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminUserImportPage() {
  return <UserImportExportPanel />;
}
