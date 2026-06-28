import { CandidateManager } from "@/components/candidates/CandidateManager";

export default function ExamOfficeCandidatesPage() {
  return (
    <CandidateManager
      apiPath="/api/exam-office/candidates"
      detailBasePath="/exam-office/candidates"
      showImportLink
      importPath="/exam-office/candidates/import"
    />
  );
}
