import { StudentUsersManager } from "@/components/users/StudentUsersManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminStudentUsersPage() {
  return <StudentUsersManager />;
}
