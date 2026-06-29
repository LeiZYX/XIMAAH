import { CandidateManager } from "@/components/candidates/CandidateManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
