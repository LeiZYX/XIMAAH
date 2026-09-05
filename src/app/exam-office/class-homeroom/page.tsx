import { ClassHomeroomTeachersPanel } from "@/components/users/ClassHomeroomTeachersPanel";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeClassHomeroomPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Class form teachers"
        description="Assign a form teacher (班主任) to each grade and class. Students need this before they can submit late adjustment requests."
      />
      <ClassHomeroomTeachersPanel apiPath="/api/exam-office/class-homeroom-teachers" />
    </div>
  );
}
