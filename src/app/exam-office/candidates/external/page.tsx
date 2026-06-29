import { CandidateManager } from "@/components/candidates/CandidateManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeExternalCandidatesPage() {
  return (
    <CandidateManager
      apiPath="/api/exam-office/candidates"
      detailBasePath="/exam-office/candidates"
      defaultCandidateType="EXTERNAL"
    />
  );
}
