import { ReviewWindowRequestList } from "@/components/review-windows/ReviewWindowRequestList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExamOfficeReviewWindowAccessToScriptPage({
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
      apiPath="access-to-script-requests"
      title="Access to script requests"
      emptyMessage="No access to script requests yet."
    />
  );
}
