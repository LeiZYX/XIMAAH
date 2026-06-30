import { ExamDocumentsManager } from "@/components/exam-documents/ExamDocumentsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeExamDocumentsPage() {
  return <ExamDocumentsManager apiBasePath="/api/exam-office" />;
}
