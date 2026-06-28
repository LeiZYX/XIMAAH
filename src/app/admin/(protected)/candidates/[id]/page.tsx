import { CandidateDetailView } from "@/components/candidates/CandidateDetailView";

export default async function AdminCandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <CandidateDetailView
      candidateId={id}
      apiPath="/api/admin/candidates"
      backHref="/admin/candidates"
    />
  );
}
