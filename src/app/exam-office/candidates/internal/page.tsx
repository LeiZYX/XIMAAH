import { CandidateManager } from "@/components/candidates/CandidateManager";

export default function ExamOfficeInternalCandidatesPage() {
  return (
    <CandidateManager
      apiPath="/api/exam-office/candidates"
      detailBasePath="/exam-office/candidates"
      defaultCandidateType="INTERNAL"
      showImportLink
      importPath="/exam-office/candidates/import"
    />
  );
}
