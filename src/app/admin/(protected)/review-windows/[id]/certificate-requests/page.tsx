import { ReviewWindowRequestList } from "@/components/review-windows/ReviewWindowRequestList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminReviewWindowCertificateRequestsPage({
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
      apiPath="certificate-requests"
      title="Certificate requests"
      emptyMessage="No certificate requests yet."
    />
  );
}
