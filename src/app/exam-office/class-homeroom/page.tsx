import { ClassHomeroomTeachersPanel } from "@/components/users/ClassHomeroomTeachersPanel";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeClassHomeroomPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Class form teachers"
        description="Assign form teachers by grade and class. Students can submit late adjustments when their grade has at least one form teacher."
      />
      <ClassHomeroomTeachersPanel apiPath="/api/exam-office/class-homeroom-teachers" />
    </div>
  );
}
