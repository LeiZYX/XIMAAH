import { CandidateManager } from "@/components/candidates/CandidateManager";

export default function AdminExternalCandidatesPage() {
  return (
    <CandidateManager
      apiPath="/api/admin/candidates"
      detailBasePath="/admin/candidates"
      defaultCandidateType="EXTERNAL"
    />
  );
}
