import { ReviewWindowRequestList } from "@/components/review-windows/ReviewWindowRequestList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminReviewWindowAccessToScriptPage({
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
      apiPath="access-to-script-requests"
      title="Access to script requests"
      emptyMessage="No access to script requests yet."
    />
  );
}
