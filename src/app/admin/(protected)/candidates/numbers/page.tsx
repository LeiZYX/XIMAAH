import { CandidateNumbersPanel } from "@/components/candidates/CandidateNumbersPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminCandidateNumbersPage() {
  return (
    <CandidateNumbersPanel
      apiPath="/api/admin/candidates"
      detailBasePath="/admin/candidates"
      moduleBasePath="/admin/candidates"
    />
  );
}
