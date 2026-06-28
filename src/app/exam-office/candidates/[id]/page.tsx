import { CandidateDetailView } from "@/components/candidates/CandidateDetailView";

export default async function ExamOfficeCandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <CandidateDetailView
      candidateId={id}
      apiPath="/api/exam-office/candidates"
      backHref="/exam-office/candidates"
    />
  );
}
