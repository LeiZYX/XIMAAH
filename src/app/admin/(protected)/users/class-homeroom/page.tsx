import { ClassHomeroomTeachersPanel } from "@/components/users/ClassHomeroomTeachersPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsersSubnav } from "@/components/users/UsersSubnav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminClassHomeroomTeachersPage() {
  return (
    <div className="space-y-4">
      <UsersSubnav />
      <PageHeader
        title="Class form teachers"
        description="Assign a form teacher (班主任) to each grade and class for student late adjustment routing."
      />
      <ClassHomeroomTeachersPanel apiPath="/api/admin/class-homeroom-teachers" />
    </div>
  );
}
