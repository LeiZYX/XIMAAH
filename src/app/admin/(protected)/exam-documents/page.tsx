import { ExamDocumentsManager } from "@/components/exam-documents/ExamDocumentsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminExamDocumentsPage() {
  return <ExamDocumentsManager apiBasePath="/api/admin" />;
}
