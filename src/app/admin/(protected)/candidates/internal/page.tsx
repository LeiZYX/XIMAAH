import { CandidateManager } from "@/components/candidates/CandidateManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminInternalCandidatesPage() {
  return (
    <CandidateManager
      apiPath="/api/admin/candidates"
      detailBasePath="/admin/candidates"
      moduleBasePath="/admin/candidates"
      defaultCandidateType="INTERNAL"
      title="Internal Candidates"
      description="Internal school students registered as exam candidates. Registrations reference these candidate records."
    />
  );
}
