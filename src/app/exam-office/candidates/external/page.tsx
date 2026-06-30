import { CandidateManager } from "@/components/candidates/CandidateManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeExternalCandidatesPage() {
  return (
    <CandidateManager
      apiPath="/api/exam-office/candidates"
      detailBasePath="/exam-office/candidates"
      moduleBasePath="/exam-office/candidates"
      defaultCandidateType="EXTERNAL"
      title="External Candidates"
      description="External exam candidates who are not school login accounts. Manage identities and board identifiers here."
    />
  );
}
