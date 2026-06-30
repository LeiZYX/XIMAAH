import { TeacherUsersManager } from "@/components/users/TeacherUsersManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminTeacherUsersPage() {
  return <TeacherUsersManager />;
}
