import { ReviewWindowServices } from "@/components/review-windows/ReviewWindowServices";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminReviewWindowServicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ReviewWindowServices
      windowId={id}
      basePath="/admin/review-windows"
      feeStatementsBasePath="/admin/fee-statements"
    />
  );
}
