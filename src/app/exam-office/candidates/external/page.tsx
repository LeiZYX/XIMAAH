import { CandidateManager } from "@/components/candidates/CandidateManager";

export default function ExamOfficeExternalCandidatesPage() {
  return (
    <CandidateManager
      apiPath="/api/exam-office/candidates"
      detailBasePath="/exam-office/candidates"
      defaultCandidateType="EXTERNAL"
    />
  );
}
