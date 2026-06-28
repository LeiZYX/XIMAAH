import { CandidateManager } from "@/components/candidates/CandidateManager";

export default function AdminCandidatesPage() {
  return (
    <CandidateManager
      apiPath="/api/admin/candidates"
      detailBasePath="/admin/candidates"
      showImportLink
      importPath="/admin/candidates/import"
    />
  );
}
