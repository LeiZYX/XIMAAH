import { CandidateManager } from "@/components/candidates/CandidateManager";

export default function AdminInternalCandidatesPage() {
  return (
    <CandidateManager
      apiPath="/api/admin/candidates"
      detailBasePath="/admin/candidates"
      defaultCandidateType="INTERNAL"
      showImportLink
      importPath="/admin/candidates/import"
    />
  );
}
