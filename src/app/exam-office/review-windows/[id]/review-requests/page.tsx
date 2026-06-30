import { ReviewWindowReviewRequests } from "@/components/review-windows/ReviewWindowReviewRequests";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExamOfficeReviewWindowReviewRequestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ReviewWindowReviewRequests
      windowId={id}
      basePath="/exam-office/review-windows"
      feeStatementsBasePath="/exam-office/fee-statements"
    />
  );
}
