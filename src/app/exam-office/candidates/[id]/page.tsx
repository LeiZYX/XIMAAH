import { CandidateDetailView } from "@/components/candidates/CandidateDetailView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
