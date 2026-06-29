import { CandidateManager } from "@/components/candidates/CandidateManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
