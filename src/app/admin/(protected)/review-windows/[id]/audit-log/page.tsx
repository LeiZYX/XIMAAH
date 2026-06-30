import { ReviewWindowAuditLog } from "@/components/review-windows/ReviewWindowAuditLog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminReviewWindowAuditLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ReviewWindowAuditLog
      windowId={id}
      basePath="/admin/review-windows"
      feeStatementsBasePath="/admin/fee-statements"
    />
  );
}
