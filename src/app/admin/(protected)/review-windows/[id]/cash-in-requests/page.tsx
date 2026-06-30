import { ReviewWindowRequestList } from "@/components/review-windows/ReviewWindowRequestList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminReviewWindowCashInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ReviewWindowRequestList
      windowId={id}
      basePath="/admin/review-windows"
      feeStatementsBasePath="/admin/fee-statements"
      apiPath="cash-in-requests"
      title="Cash-in requests"
      emptyMessage="No cash-in requests yet."
    />
  );
}
