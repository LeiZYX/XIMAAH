import { CandidateNumbersPanel } from "@/components/candidates/CandidateNumbersPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeCandidateNumbersPage() {
  return (
    <CandidateNumbersPanel
      apiPath="/api/exam-office/candidates"
      detailBasePath="/exam-office/candidates"
      moduleBasePath="/exam-office/candidates"
    />
  );
}
