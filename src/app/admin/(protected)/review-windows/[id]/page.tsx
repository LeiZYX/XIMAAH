import { ReviewWindowGeneral } from "@/components/review-windows/ReviewWindowGeneral";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminReviewWindowGeneralPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ReviewWindowGeneral
      windowId={id}
      basePath="/admin/review-windows"
      feeStatementsBasePath="/admin/fee-statements"
    />
  );
}
