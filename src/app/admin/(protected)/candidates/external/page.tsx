import { CandidateManager } from "@/components/candidates/CandidateManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminExternalCandidatesPage() {
  return (
    <CandidateManager
      apiPath="/api/admin/candidates"
      detailBasePath="/admin/candidates"
      moduleBasePath="/admin/candidates"
      defaultCandidateType="EXTERNAL"
      title="External Candidates"
      description="External exam candidates who are not school login accounts. Manage identities and board identifiers here."
    />
  );
}
