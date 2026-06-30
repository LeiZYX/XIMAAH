import { ReviewWindowRequestList } from "@/components/review-windows/ReviewWindowRequestList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExamOfficeReviewWindowCashInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ReviewWindowRequestList
      windowId={id}
      basePath="/exam-office/review-windows"
      feeStatementsBasePath="/exam-office/fee-statements"
      apiPath="cash-in-requests"
      title="Cash-in requests"
      emptyMessage="No cash-in requests yet."
    />
  );
}
