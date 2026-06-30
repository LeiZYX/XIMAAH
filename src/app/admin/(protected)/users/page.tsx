import { AllUsersManager } from "@/components/users/AllUsersManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminUsersPage() {
  return <AllUsersManager />;
}
