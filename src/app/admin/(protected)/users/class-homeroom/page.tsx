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
        description="Assign form teachers by grade and class for late adjustment routing. Same-grade form teachers can receive and review requests."
      />
      <ClassHomeroomTeachersPanel apiPath="/api/admin/class-homeroom-teachers" />
    </div>
  );
}
